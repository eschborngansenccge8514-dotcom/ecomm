import { getSupabaseClient } from "./supabase.ts";

export interface SyncJob {
  id: string;
  tenant_id: string;
  marketplace_account_id: string;
  provider: string;
  job_type: string;
  payload: any;
  status: string;
  attempt_count: number;
  max_attempts: number;
}

/**
 * Claim the next available sync jobs for processing.
 * Uses a record-level lock to ensure multiple runners don't process the same job.
 */
export async function claimSyncJobs(limit: number = 10): Promise<SyncJob[]> {
  const supabase = getSupabaseClient();
  const lockToken = crypto.randomUUID();

  // Atomically claim jobs by setting lock_token and status
  const { data, error } = await supabase.rpc("claim_marketplace_sync_jobs", {
    p_lock_token: lockToken,
    p_limit: limit,
  });

  if (error || !data) return [];
  return data;
}

/**
 * Update the status of a sync job.
 */
export async function updateJobStatus(
  jobId: string,
  status: "succeeded" | "failed" | "processing",
  details: {
    errorCode?: string;
    errorMessage?: string;
    errorPayload?: any;
    finishedAt?: string;
  } = {}
): Promise<void> {
  const supabase = getSupabaseClient();
  const updates: any = {
    status,
    updated_at: new Date().toISOString(),
    ...details,
  };

  if (status === "succeeded" || status === "failed") {
    updates.finished_at = details.finishedAt || new Date().toISOString();
    updates.lock_token = null;
    updates.locked_at = null;
  }

  const { error } = await supabase
    .from("marketplace_sync_jobs")
    .update(updates)
    .eq("id", jobId);

  if (error) throw error;
}

/**
 * Record a failed attempt and schedule a retry if attempts remain.
 */
export async function recordJobFailure(
  jobId: string,
  errorCode: string,
  errorMessage: string,
  errorPayload: any = {}
): Promise<void> {
  const supabase = getSupabaseClient();

  // Fetch current job stats
  const { data: job, error: fetchError } = await supabase
    .from("marketplace_sync_jobs")
    .select("attempt_count, max_attempts")
    .eq("id", jobId)
    .single();

  if (fetchError || !job) return;

  const nextAttemptCount = job.attempt_count + 1;
  const isFinalFailure = nextAttemptCount >= job.max_attempts;

  const updates: any = {
    attempt_count: nextAttemptCount,
    last_error_code: errorCode,
    last_error_message: errorMessage,
    last_error_payload: errorPayload,
    updated_at: new Date().toISOString(),
  };

  if (isFinalFailure) {
    updates.status = "failed";
    updates.finished_at = new Date().toISOString();
    updates.lock_token = null;
    updates.locked_at = null;
  } else {
    updates.status = "queued";
    updates.lock_token = null;
    updates.locked_at = null;
    // Exponential backoff for retries: 5, 15, 45, 135 minutes
    const backoffMinutes = Math.pow(3, nextAttemptCount) * 5;
    updates.next_retry_at = new Date(
      Date.now() + backoffMinutes * 60 * 1000
    ).toISOString();
    updates.scheduled_at = updates.next_retry_at;
  }

  await supabase.from("marketplace_sync_jobs").update(updates).eq("id", jobId);
}
