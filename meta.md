<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Can we connect to Facebook and Instagram to automatically upload content

Yes, absolutely — this is fully achievable through the **Meta Graph API v25.0**, and it slots naturally into your existing `packages/integrations` and `apps/functions-worker` architecture alongside your Shopee, Lazada, and TikTok Shop connectors.  There are two distinct integration surfaces to build.[^1][^2]

***

## Two Integration Surfaces

| Surface | API | What it does |
| :-- | :-- | :-- |
| **Content Publishing** [^3] | Instagram Content Publishing API + Facebook Pages API [^3] | Auto-post product images, promotions, reels, and carousels to Instagram Business and Facebook Pages [^4] |
| **Catalog Sync** [^5] | Facebook Catalog / Commerce Manager API [^6] | Sync your merchant's product catalog to Facebook Commerce Manager, enabling Instagram Shopping tags and Facebook Shop [^7] |


***

## How It Fits Your Architecture

Your `apps/functions-worker` Cloudflare Worker already aggregates Shopee, Lazada, and TikTok Shop — Meta is the same pattern.  The OAuth token exchange and API calls live in `packages/integrations/src/meta/`, and the worker exposes routes for posting, scheduling, and catalog sync triggers.[^2]

```
packages/integrations/src/
├── shopee/          ← already exists
├── lazada/          ← already exists
├── tiktok/          ← already exists
└── meta/            ← new
    ├── client.ts        # Graph API HTTP client
    ├── auth.ts          # OAuth 2.0 + long-lived token exchange
    ├── publisher.ts     # Content Publishing API
    └── catalog.ts       # Catalog / Product Feed API
```


***

## Part 1 — Content Publishing (Auto-posting)

### What you can post automatically

- **New product launches** — When a merchant publishes a new product in the catalog, auto-generate a post with the product image from Supabase Storage, name, price, and a shop link[^3]
- **Flash sales / promotions** — When a promotion goes live (from your planned Flash Sales Engine), fire a post with countdown text and promo code[^4]
- **Carousel posts** — Post multiple product images in a single carousel, ideal for "New Arrivals" collections[^3]
- **Reels** — Post short video content (merchants can upload a video in the dashboard and schedule it)[^3]


### How the API works (two-step publish)

Instagram's Content Publishing API requires two calls — create a media container, then publish it:[^3]

```typescript
// packages/integrations/src/meta/publisher.ts

export class MetaPublisher {
  constructor(
    private readonly accessToken: string,
    private readonly igUserId: string,
    private readonly fbPageId: string,
  ) {}

  // Step 1: Create a media container
  async createContainer(params: {
    imageUrl: string;
    caption: string;
  }): Promise<string> {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${this.igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url:    params.imageUrl,
          caption:      params.caption,
          access_token: this.accessToken,
        }),
      }
    );
    const data = await res.json<{ id: string }>();
    return data.id; // container ID
  }

  // Step 2: Publish the container
  async publishContainer(containerId: string): Promise<string> {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${this.igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id:  containerId,
          access_token: this.accessToken,
        }),
      }
    );
    const data = await res.json<{ id: string }>();
    return data.id; // published post ID
  }

  // Carousel post (multiple images)
  async publishCarousel(params: {
    imageUrls: string[];
    caption: string;
  }): Promise<string> {
    // Create a child container for each image
    const childIds = await Promise.all(
      params.imageUrls.map((url) =>
        this.createContainer({ imageUrl: url, caption: '' }).then((id) => id)
      )
    );

    // Create carousel container
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${this.igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type:   'CAROUSEL',
          children:     childIds.join(','),
          caption:      params.caption,
          access_token: this.accessToken,
        }),
      }
    );
    const data = await res.json<{ id: string }>();
    return this.publishContainer(data.id);
  }

  // Post to Facebook Page
  async postToFacebookPage(params: {
    message: string;
    imageUrl?: string;
  }): Promise<string> {
    const body: Record<string, string> = {
      message:      params.message,
      access_token: this.accessToken,
    };
    if (params.imageUrl) body.url = params.imageUrl;

    const endpoint = params.imageUrl ? 'photos' : 'feed';
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${this.fbPageId}/${endpoint}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const data = await res.json<{ id: string }>();
    return data.id;
  }
}
```


### Scheduling posts

Store scheduled posts in a `social_posts` Supabase table with a `scheduled_at` column. A Supabase Edge Function cron job (every 5 minutes) queries posts due to publish and fires the two-step API call.[^8]

```sql
CREATE TABLE social_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  UUID NOT NULL REFERENCES merchants(id),
  platform     TEXT NOT NULL,   -- 'instagram' | 'facebook' | 'both'
  status       TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'published' | 'failed'
  image_urls   TEXT[],
  caption      TEXT,
  post_type    TEXT DEFAULT 'single', -- 'single' | 'carousel' | 'reel'
  platform_post_id TEXT,             -- returned ID after publishing
  scheduled_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```


***

## Part 2 — Product Catalog Sync

Facebook Commerce Manager allows merchants to list products on Instagram Shopping and Facebook Shop.  Rather than manual uploads, your platform generates a **product feed URL** that Facebook polls automatically.[^5][^7]

### Feed URL approach (simplest and most reliable)

Generate a dynamic JSON or XML feed endpoint in `apps/dashboard` that Facebook Commerce Manager polls on a schedule (daily or on-demand):[^5]

```typescript
// apps/dashboard/app/api/meta/catalog/[merchantId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getActiveProducts } from '@/lib/products/queries';

export async function GET(
  req: NextRequest,
  { params }: { params: { merchantId: string } }
) {
  const products = await getActiveProducts(params.merchantId);

  // Facebook expects this exact JSON structure
  const feed = {
    data: products.map((p) => ({
      id:               p.id,
      title:            p.name,
      description:      p.description ?? p.name,
      availability:     p.stockQuantity > 0 ? 'in stock' : 'out of stock',
      condition:        'new',
      price:            `${Number(p.price).toFixed(2)} MYR`,
      link:             `https://hyperlocal.app/products/${p.id}`,
      image_link:       p.imageUrl,
      brand:            p.merchantName,
      retailer_id:      p.id,
    })),
  };

  return NextResponse.json(feed, {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

Register this URL in **Facebook Commerce Manager → Catalog → Data Sources → Use a URL**. Set the fetch schedule to daily. Any product created, updated, or deactivated in your dashboard will automatically reflect in Facebook/Instagram Shopping.[^5]

***

## Part 3 — OAuth \& Token Management

Meta uses OAuth 2.0 with **long-lived tokens** (valid for 60 days) that must be refreshed before expiry.  Store tokens in Supabase against `merchant_id` and run a daily cron to refresh any token expiring within 7 days.[^4]

```typescript
// packages/integrations/src/meta/auth.ts

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL('https://graph.facebook.com/v25.0/oauth/access_token');
  url.searchParams.set('grant_type',        'fb_exchange_token');
  url.searchParams.set('client_id',         appId);
  url.searchParams.set('client_secret',     appSecret);
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  const res = await fetch(url.toString());
  const data = await res.json<{ access_token: string; expires_in: number }>();

  return {
    accessToken: data.access_token,
    expiresIn:   data.expires_in, // ~5,183,944 seconds (60 days)
  };
}
```

Store the OAuth connection state in a `merchant_social_accounts` table:

```sql
CREATE TABLE merchant_social_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID NOT NULL REFERENCES merchants(id),
  platform          TEXT NOT NULL,       -- 'meta'
  ig_user_id        TEXT,
  fb_page_id        TEXT,
  access_token      TEXT NOT NULL,
  token_expires_at  TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```


***

## Part 4 — Dashboard UI (Social Hub)

Add a **Social** section to `apps/dashboard` where merchants connect their accounts, compose posts, and schedule them:

```
app/(dashboard)/social/
├── page.tsx                  # Overview: connected accounts + post history
├── connect/page.tsx          # OAuth connect flow (Facebook Login button)
├── compose/page.tsx          # Post composer with image picker, caption, schedule time
└── _components/
    ├── account-connection-card.tsx
    ├── post-composer.tsx
    ├── scheduled-posts-table.tsx
    └── platform-toggle.tsx   # Choose Instagram, Facebook, or both
```

The post composer lets merchants write a caption, pick images from their Supabase Storage product library, toggle which platforms to post to, and set a scheduled time. An AI-assisted caption generator can be wired to the existing Gemini SDK — the merchant picks a product and the agent drafts a social caption with relevant hashtags.

***

## Important Prerequisites

Before writing any code, you need to complete Meta's app review process:[^9]

1. Create a **Meta App** at [developers.facebook.com](https://developers.facebook.com) → set type to **Business**
2. Add the **Instagram Graph API** and **Pages API** products
3. Request permissions: `instagram_basic`, `instagram_content_publish`, `pages_manage_posts`, `pages_read_engagement`, `catalog_management`
4. Submit for **App Review** — Meta requires you to demonstrate each permission use case with a screen recording. Approval typically takes **5–7 business days**[^9]
5. Merchants must have an **Instagram Business Account** (not Personal) linked to a **Facebook Page** for the publishing API to work[^3]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16]</span>

<div align="center">⁂</div>

[^1]: https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/

[^2]: PROJECT_SUMMARY.md

[^3]: https://developers.facebook.com/docs/instagram-platform/content-publishing/

[^4]: https://n8n.io/workflows/5457-automate-instagram-and-facebook-posting-with-meta-graph-api-and-system-user-tokens/

[^5]: https://support.storeconnect.com/article/facebook-catalogue-data-feed

[^6]: https://www.youtube.com/watch?v=Bj3iVwyPuNg

[^7]: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/available_catalogs/

[^8]: https://gist.github.com/PrenSJ2/0213e60e834e66b7e09f7f93999163fc

[^9]: https://developers.facebook.com/blog/post/2025/01/21/making-it-easier-to-build-integrations-across-the-instagram-api-and-marketing-api/

[^10]: https://developers.facebook.com/docs/graph-api/changelog/non-versioned-changes/nvc-2025/

[^11]: https://developers.facebook.com/products/instagram/apis/

[^12]: https://help.instagram.com/1187859655048322/

[^13]: https://elfsight.com/blog/instagram-graph-api-changes/

[^14]: https://www.conversios.io/blog/how-to-sync-your-woocommerce-products-to-facebook-catalog-2025-guide/

[^15]: https://developers.facebook.com/blog/post/2025/10/08/introducing-graph-api-v24-and-marketing-api-v24/

[^16]: https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/

