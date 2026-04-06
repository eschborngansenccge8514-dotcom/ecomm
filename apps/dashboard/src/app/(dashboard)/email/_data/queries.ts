import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type EmailLog = {
  id: string;
  resend_id: string | null;
  template: string;
  recipient: string;
  status: 'sent' | 'delivered' | 'failed' | 'bounced' | 'complained';
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type EmailKpis = {
  total: number;
  delivered: number;
  failed: number;
  bounced: number;
};

// Internal admin client using service role for log access
async function createAdminClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* Server Component */ }
        },
      },
    }
  );
}

export async function getEmailKpis(): Promise<EmailKpis> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from('email_logs')
    .select('status');

  if (error) {
    console.error('[queries] getEmailKpis error:', error.message);
    return { total: 0, delivered: 0, failed: 0, bounced: 0 };
  }

  const rows = data ?? [];
  return {
    total:     rows.length,
    delivered: rows.filter((r) => r.status === 'delivered').length,
    failed:    rows.filter((r) => r.status === 'failed').length,
    bounced:   rows.filter((r) => r.status === 'bounced').length,
  };
}

export async function getEmailLogs(opts?: {
  status?: string;
  template?: string;
  limit?: number;
}): Promise<EmailLog[]> {
  const supabase = await createAdminClient();
  let query = supabase
    .from('email_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.status)   query = query.eq('status', opts.status);
  if (opts?.template) query = query.eq('template', opts.template);

  const { data, error } = await query;
  
  if (error) {
    console.error('[queries] getEmailLogs error:', error.message);
    return [];
  }

  console.log(`[queries] getEmailLogs success count: ${data?.length || 0}`);
  return (data ?? []) as EmailLog[];
}
