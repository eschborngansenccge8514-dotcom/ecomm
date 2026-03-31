import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { claimSyncJobs, recordJobFailure, updateJobStatus } from "../_shared/jobs.ts";
import { handlers } from "../_shared/handlers/index.ts";
import { logError } from "../_shared/logger.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // 1. Basic Auth Check (Internal call only)
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    // Note: In local development, you might want to skip this or use a test key
    if (Deno.env.get("ENVIRONMENT") === "production") {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    // 2. Claim available jobs
    const jobs = await claimSyncJobs(10);
    console.log(`[Job Runner] Claimed ${jobs.length} jobs`);

    if (jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No jobs to process" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Process jobs in parallel (with individual error handling)
    const results = await Promise.allSettled(
      jobs.map(async (job) => {
        try {
          const handler = handlers[job.provider];
          if (!handler) {
            throw new Error(`Unsupported provider: ${job.provider}`);
          }

          await handler.handle(job);
          await updateJobStatus(job.id, "succeeded");
        } catch (e) {
          console.error(`[Job Runner] Job ${job.id} failed:`, e);
          
          const errorMessage = e instanceof Error ? e.message : String(e);
          await recordJobFailure(job.id, "JOB_EXECUTION_ERROR", errorMessage);
          
          await logError({
            tenant_id: job.tenant_id,
            marketplace_account_id: job.marketplace_account_id,
            provider: job.provider as any,
            job_id: job.id,
            errorCode: "HANDLER_FAILURE",
            errorMessage: errorMessage,
            severity: "error",
          });
        }
      })
    );

    return new Response(JSON.stringify({ jobsProcessed: jobs.length, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[Job Runner] Master failure:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
