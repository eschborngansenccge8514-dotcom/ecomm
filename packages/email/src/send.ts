import { resend } from './client';
import type { CreateEmailOptions } from 'resend';
import { createClient } from '@supabase/supabase-js';

export type SendResult =
  | { success: true; id: string }
  | { success: false; error: string };

const toOverride = process.env.EMAIL_OVERRIDE_TO;

// Optional Supabase client for logging
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

/**
 * A unified wrapper with consistent error logging used by all callers.
 * Supports EMAIL_OVERRIDE_TO for safe local testing.
 * Automatically logs to public.email_logs if Supabase credentials are provided.
 */
export async function sendEmail(
  options: CreateEmailOptions,
  meta?: {
    templateName?: string;
    metadata?: Record<string, any>;
  }
): Promise<SendResult> {
  const recipient = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  const template = meta?.templateName || 'raw';
  
  try {
    const finalOptions = toOverride
      ? { ...options, to: toOverride }
      : options;

    const { data, error } = await resend.emails.send(finalOptions);
    
    if (error) {
      console.error('[resend] error:', error.message);
      
      // Log failure
      if (supabase) {
        await supabase.from('email_logs').insert({
          recipient,
          template,
          status: 'failed',
          error: error.message,
          metadata: meta?.metadata
        });
      }
      
      return { success: false, error: error.message };
    }
    
    const resendId = data!.id;

    // Log success
    if (supabase) {
      await supabase.from('email_logs').insert({
        resend_id: resendId,
        recipient,
        template,
        status: 'sent',
        metadata: meta?.metadata
      });
    }
    
    return { success: true, id: resendId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[resend] send failed:', message);
    
    // Log unexpected error
    if (supabase) {
      await supabase.from('email_logs').insert({
        recipient,
        template,
        status: 'failed',
        error: message,
        metadata: meta?.metadata
      });
    }
    
    return { success: false, error: message };
  }
}
