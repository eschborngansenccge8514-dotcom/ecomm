<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Ok, now that our ai agent can send email, I want it able to receive email. Can it be achieved?

Yes — **Resend launched native inbound email support in November 2025**, making this entirely achievable without adding any new infrastructure to your stack.  Given that your `apps/functions-worker` Cloudflare Worker already handles incoming webhooks from Stripe, Shopee, Lalamove, etc., the inbound email pipeline slots in naturally alongside them.[^1]

## How Resend Inbound Works

When an email arrives at your address, Resend parses it and fires an `email.received` webhook to an endpoint you configure.  Crucially, **the webhook only contains metadata** (from, to, subject, attachment names) — you must make a second API call to the Resend Receiving API to fetch the full HTML/text body, and a third call to the Attachments API for any files.  Your Cloudflare Worker receives the webhook, fetches the body, and hands the content off to your existing `packages/support-agent` or `packages/agent` for the AI to process and reply.[^2][^3]

The full flow for your app:

```
Customer emails support@mail.yourdomain.com
    ↓
Resend Inbound (parses email → JSON)
    ↓
POST email.received webhook → apps/functions-worker
    ↓
Worker calls Resend Receiving API to fetch body + attachments
    ↓
packages/support-agent (AI Support Orchestrator processes content)
    ↓
sendEmail() via @repo/email → reply sent back to customer
```


***

## Setup Steps

### Step 1 — Enable Inbound in Resend

In your Resend dashboard, go to **Emails → Receiving**.  You have two address options:[^2]


| Option | Address format | DNS needed |
| :-- | :-- | :-- |
| **Resend-managed** (fastest) | `support@<your-id>.resend.app` | None — works immediately |
| **Custom domain** | `support@mail.yourdomain.com` | Add Resend's MX record to your subdomain |

For production, use the custom domain. Add the MX record Resend provides in the dashboard to your DNS provider (same flow as Phase 2, but an `MX` record on `mail.yourdomain.com` pointing to Resend instead of a `send.` prefix).[^3]

> ⚠️ If your subdomain `mail.yourdomain.com` already has an MX record from Phase 2 (for SPF return-path), Resend's inbound MX record must have a **lower priority number** to win routing. Alternatively, use a dedicated subdomain like `support.yourdomain.com` for inbound only.

### Step 2 — Register the Webhook in Resend

In **Resend Dashboard → Webhooks**, create a new webhook:

- **Endpoint URL**: `https://your-worker.workers.dev/webhooks/resend`
- **Events**: check `email.received` (in addition to the delivery events already wired)

Your existing `/webhooks/resend` route in `apps/functions-worker` already handles `email.delivered`, `email.bounced`, etc. — extend it to also handle `email.received`.

### Step 3 — Handle the Webhook in the Worker

`apps/functions-worker/src/routes/webhooks/resend.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

export async function handleResendWebhook(req: Request, env: Env) {
  const event = await req.json<{
    type: string;
    data: {
      email_id: string;
      from: string;
      to: string[];
      subject: string;
    };
  }>();

  // --- Existing delivery event handling ---
  const statusMap: Record<string, string> = {
    'email.delivered':  'delivered',
    'email.bounced':    'bounced',
    'email.complained': 'complained',
    'email.failed':     'failed',
  };
  if (statusMap[event.type]) {
    await updateEmailLog(event.data.email_id, statusMap[event.type], env);
    return new Response('ok', { status: 200 });
  }

  // --- New: inbound email handling ---
  if (event.type === 'email.received') {
    // Return 200 immediately so Resend doesn't retry
    const response = new Response('ok', { status: 200 });

    // Process asynchronously using waitUntil (Cloudflare Workers pattern)
    env.ctx.waitUntil(processInboundEmail(event.data, env));

    return response;
  }

  return new Response('ignored', { status: 200 });
}

async function processInboundEmail(
  meta: { email_id: string; from: string; to: string[]; subject: string },
  env: Env
) {
  // Step 1: Fetch the full email body from Resend Receiving API
  const bodyRes = await fetch(
    `https://api.resend.com/emails/${meta.email_id}`,
    { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } }
  );
  const email = await bodyRes.json<{
    html: string;
    text: string;
    attachments: Array<{ id: string; filename: string }>;
  }>();

  // Step 2: Route based on the recipient address
  const toAddress = meta.to[^0] ?? '';

  if (toAddress.startsWith('support@')) {
    await routeToSupportAgent(meta, email, env);
  } else if (toAddress.startsWith('merchant@') || toAddress.startsWith('orders@')) {
    await routeToMerchantAgent(meta, email, env);
  }
}
```


### Step 4 — Route to the AI Support Agent

```typescript
async function routeToSupportAgent(
  meta: { from: string; subject: string },
  email: { text: string; attachments: Array<{ id: string; filename: string }> },
  env: Env
) {
  // Call your existing support-agent package via its HTTP interface
  // or invoke it directly if co-located
  const agentRes = await fetch(`${env.SUPPORT_AGENT_URL}/handle-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: meta.from,
      subject: meta.subject,
      body: email.text,
      attachmentCount: email.attachments.length,
    }),
  });

  const { replyText } = await agentRes.json<{ replyText: string }>();

  // Step 3: Send the AI-generated reply back to the customer
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Support <support@mail.yourdomain.com>',
      to: meta.from,
      subject: `Re: ${meta.subject}`,
      text: replyText,
    }),
  });
}
```


### Step 5 — Add the Agent Email Handler (`packages/support-agent`)

In your existing `packages/support-agent`, add a `handleEmailInput()` function alongside whatever chat/message handlers you already have:

```typescript
// packages/support-agent/src/email-handler.ts
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function handleEmailInput(input: {
  from: string;
  subject: string;
  body: string;
}) {
  const { text } = await generateText({
    model: google('gemini-2.5-flash-lite'),
    system: `You are a helpful customer support agent for Hyperlocal.
             Reply professionally and concisely to the customer's email.
             Do not include a subject line. Write only the email body.`,
    prompt: `From: ${input.from}
Subject: ${input.subject}

${input.body}`,
  });

  return { replyText: text };
}
```


***

## What Your Agent Can Do With Inbound Email

Given your existing AI infrastructure, inbound email immediately unlocks several use cases:[^1]

- **Support replies** — Customer emails `support@mail.yourdomain.com`, the Support Orchestrator reads it and replies automatically or routes to a human
- **Order queries** — Customer emails `orders@mail.yourdomain.com` with an order number; the Merchant Assistant looks it up and replies with status
- **Forwarded receipts/invoices** — Merchants forward documents to a processing address; the agent extracts and ingests data using the Attachments API
- **Merchant help desk** — Merchants email `merchant@mail.yourdomain.com` with operational questions answered by the Merchant Assistant Agent

***

## One Important Caveat

Resend Inbound is currently only available on **paid plans**.  Check your current Resend billing tier before building the integration — you may need to upgrade if you're on the free tier.[^3]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://resend.com/blog/new-features-in-2025

[^2]: https://www.youtube.com/watch?v=Q2sGAoNHbdM

[^3]: https://playbooks.com/skills/resend/resend-skills/resend-inbound

[^4]: https://resend.com/blog/inbound-emails

[^5]: https://www.linkedin.com/posts/yokoli_this-is-huge-now-you-can-receive-emails-activity-7391152301085945856-mhkt

[^6]: https://docs.aiinbx.com/webhooks

[^7]: https://www.mailgun.com/blog/email/best-email-api-services-2025/

[^8]: https://www.linkedin.com/posts/resend_introducing-inbound-by-resend-we-started-activity-7391130916657700864-XSRu

[^9]: https://www.cloudmailin.com/blog/receive-email-with-nextjs-in-2023

[^10]: https://emailable.com/blog/top-email-api/

[^11]: https://www.linkedin.com/posts/rehan-van-der-merwe-600b40172_when-i-joined-resend-we-were-doing-only-outbound-activity-7391155100712448000-fl8d

[^12]: https://www.pingram.io/blog/inbound-email-notification-webhooks-nextjs-vercel

[^13]: https://www.mailerlite.com/blog/email-apis

[^14]: https://alternativeto.net/news/2025/11/resend-adds-inbound-feature-for-webhooks-based-email-receiving-and-processing/

[^15]: https://dev.to/hookdeck/how-to-make-your-ai-agent-get-webhooks-right-a-guide-to-webhook-skills-17im

