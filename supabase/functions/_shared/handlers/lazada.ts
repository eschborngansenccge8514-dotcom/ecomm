import { SyncJob, updateJobStatus } from "../jobs.ts";
import { ProviderHandler } from "./index.ts";

export class LazadaHandler implements ProviderHandler {
  async handle(job: SyncJob): Promise<void> {
    console.log(`[Lazada] Handling job ${job.id} of type ${job.job_type}`);
    // TODO: Implement Lazada logic
    await updateJobStatus(job.id, "succeeded");
  }
}
