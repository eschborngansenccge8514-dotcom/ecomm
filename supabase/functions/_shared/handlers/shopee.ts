import { SyncJob, updateJobStatus } from "../jobs.ts";
import { ProviderHandler } from "./index.ts";

export class ShopeeHandler implements ProviderHandler {
  async handle(job: SyncJob): Promise<void> {
    console.log(`[Shopee] Handling job ${job.id} of type ${job.job_type}`);
    // TODO: Implement Shopee logic
    await updateJobStatus(job.id, "succeeded");
  }
}
