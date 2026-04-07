import { resend } from './client';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export interface CampaignMerchant {
  id: string;
  marketing_domain?: string | null;
  marketing_from_name?: string | null;
}

/**
 * Sends a marketing campaign using Resend's batch API.
 * Chunks recipients into batches of 100 (Resend limit).
 */
export async function sendMarketingCampaign(
  campaignId: string,
  merchant: CampaignMerchant,
  recipients: { email: string; name: string }[],
  subject: string,
  content: string,
  unsubscribeBaseUrl: string,
  scheduledAt?: string | null
) {
  if (!supabase) {
    console.error('[marketing] Supabase client not initialized');
    return { success: false, error: 'Internal configuration error' };
  }

  const fromDomain = merchant.marketing_domain || process.env.RESEND_FROM_DOMAIN || 'resend.dev';
  const fromName = merchant.marketing_from_name || 'Marketing';
  const fromEmail = `${fromName} <marketing@${fromDomain}>`;

  // Fetch non-opted-out recipients from the provided list
  const { data: optedOut } = await supabase
    .from('profiles')
    .select('email')
    .in('email', recipients.map(r => r.email))
    .eq('marketing_opt_out', true);

  const optedOutEmails = new Set(optedOut?.map(p => p.email) || []);
  const validRecipients = recipients.filter(r => !optedOutEmails.has(r.email));

  if (validRecipients.length === 0) {
    await supabase.from('email_campaigns').update({ status: 'failed', error_message: 'No valid recipients (all opted out)' }).eq('id', campaignId);
    return { success: false, error: 'All target recipients have opted out' };
  }

  // Chunk recipients into batches of 100
  const BATCH_SIZE = 100;
  const batches = [];
  for (let i = 0; i < validRecipients.length; i += BATCH_SIZE) {
    batches.push(validRecipients.slice(i, i + BATCH_SIZE));
  }

  let totalSent = 0;
  const errors: string[] = [];

  // Update status to sending (or scheduled)
  await supabase.from('email_campaigns').update({ status: scheduledAt ? 'draft' : 'sending' }).eq('id', campaignId);

  for (const batch of batches) {
    try {
      const emailBatch = batch.map(recipient => {
        const to = recipient.email;
        const name = recipient.name;
        const unsubscribeUrl = `${unsubscribeBaseUrl}?email=${encodeURIComponent(to)}`;
        const footer = `<br/><br/><hr/><p style="font-size: 10px; color: #666;">You're receiving this because you're a customer of ${merchant.marketing_from_name || 'our store'}. <a href="${unsubscribeUrl}">Unsubscribe</a></p>`;
        
        // Personalization
        const personalizedContent = content.replace(/\{\{customer_name\}\}/g, name);
        const personalizedSubject = subject.replace(/\{\{customer_name\}\}/g, name);

        return {
          from: fromEmail,
          to,
          subject: personalizedSubject,
          html: personalizedContent.replace(/\n/g, '<br/>') + footer,
          scheduled_at: scheduledAt || undefined,
          tags: [{ name: 'campaign_id', value: campaignId }]
        };
      });

      const { error } = await resend.batch.send(emailBatch);

      if (error) {
        console.error('[marketing] batch send error:', error.message);
        errors.push(error.message);
      } else {
        totalSent += batch.length;
      }
    } catch (err: any) {
      console.error('[marketing] unexpected error:', err.message);
      errors.push(err.message);
    }
  }

  const status = errors.length > 0 ? (totalSent > 0 ? 'sent' : 'failed') : 'sent';
  const errorMessage = errors.length > 0 ? errors.slice(0, 3).join('; ') : null;

  await supabase.from('email_campaigns').update({
    status,
    total_recipients: totalSent,
    sent_at: new Date().toISOString(),
    error_message: errorMessage
  }).eq('id', campaignId);

  return { success: status === 'sent', totalSent, error: errorMessage };
}
