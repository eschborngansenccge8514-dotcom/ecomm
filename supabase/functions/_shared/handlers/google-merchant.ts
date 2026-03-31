import { SyncJob, updateJobStatus } from "../jobs.ts";
import { ProviderHandler } from "./index.ts";

export class GoogleMerchantHandler implements ProviderHandler {
  async handle(job: SyncJob): Promise<void> {
    console.log(`[GMC] Handling job ${job.id} of type ${job.job_type}`);
    // TODO: Implement Google Merchant logic
    await updateJobStatus(job.id, "succeeded");
  }
}
