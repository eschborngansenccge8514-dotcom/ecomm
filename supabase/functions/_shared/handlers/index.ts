import { SyncJob } from "../jobs.ts";

export interface ProviderHandler {
  handle(job: SyncJob): Promise<void>;
}

import { ShopeeHandler } from "./shopee.ts";
import { TikTokHandler } from "./tiktok.ts";
import { LazadaHandler } from "./lazada.ts";
import { GoogleMerchantHandler } from "./google-merchant.ts";

export const handlers: Record<string, ProviderHandler> = {
  shopee: new ShopeeHandler(),
  tiktok: new TikTokHandler(),
  lazada: new LazadaHandler(),
  google_merchant: new GoogleMerchantHandler(),
};
