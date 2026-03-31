import { SyncJob, updateJobStatus } from "../jobs.ts";
import { ProviderHandler } from "./index.ts";

export class TikTokHandler implements ProviderHandler {
  async handle(job: SyncJob): Promise<void> {
    console.log(`[TikTok] Handling job ${job.id} of type ${job.job_type}`);
    // TODO: Implement TikTok logic
    await updateJobStatus(job.id, "succeeded");
  }
}
