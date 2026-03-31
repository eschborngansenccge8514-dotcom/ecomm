import { getSupabaseClient } from "./supabase.ts";

export interface LogEntry {
  tenant_id?: string;
  marketplace_account_id?: string;
  provider?: string;
  job_id?: string;
  event_id?: string;
  errorCode: string;
  errorMessage: string;
  errorPayload?: any;
  severity: "critical" | "error" | "warning" | "suggestion";
}

/**
 * Log a marketplace error to the centralized error logs table.
 */
export async function logError(entry: LogEntry): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("marketplace_error_logs").insert({
    tenant_id: entry.tenant_id,
    marketplace_account_id: entry.marketplace_account_id,
    provider: entry.provider,
    job_id: entry.job_id,
    event_id: entry.event_id,
    error_code: entry.errorCode,
    error_message: entry.errorMessage,
    error_payload: entry.errorPayload,
    severity: entry.severity,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to log marketplace error to database:", error);
    console.error("Original error:", entry.errorMessage);
  }
}
