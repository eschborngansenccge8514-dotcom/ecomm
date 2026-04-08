import { createClient } from '@/lib/supabase/server';

export type EmailLog = {
  id: string;
  resend_id: string | null;
  template: string;
  recipient: string;
  status: 'received' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'complained';
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type EmailKpis = {
  total: number;
  delivered: number;
  received: number;
  failed: number;
  bounced: number;
};

export async function getEmailKpis(merchantId: string): Promise<EmailKpis> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('email_logs')
    .select('status')
    .eq('merchant_id', merchantId);

  if (error) {
    console.error('[queries] getEmailKpis error:', error.message);
    return { total: 0, delivered: 0, received: 0, failed: 0, bounced: 0 };
  }

  const rows = data ?? [];
  return {
    total:     rows.filter(r => r.status !== 'received').length,
    delivered: rows.filter((r) => r.status === 'delivered').length,
    received:  rows.filter((r) => r.status === 'received').length,
    failed:    rows.filter((r) => r.status === 'failed').length,
    bounced:   rows.filter((r) => r.status === 'bounced').length,
  };
}

export async function getEmailLogs(merchantId: string, opts?: {
  status?: string;
  template?: string;
  limit?: number;
}): Promise<EmailLog[]> {
  const supabase = await createClient();
  let query = supabase
    .from('email_logs')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.status)   query = query.eq('status', opts.status);
  if (opts?.template) query = query.eq('template', opts.template);

  const { data, error } = await query;

  if (error) {
    console.error('[queries] getEmailLogs error:', error.message);
    return [];
  }

  return (data ?? []) as EmailLog[];
}
