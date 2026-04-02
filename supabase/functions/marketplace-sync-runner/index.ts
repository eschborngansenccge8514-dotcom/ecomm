import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { getSupabaseClient } from '../_shared/marketplace.ts'
import { ShopeeClient } from '../../packages/integrations/shopee/client.ts'
import { decryptJson } from "../../packages/integrations/crypto.ts";
import { mapShopeeOrderToCanonical } from "../../packages/integrations/shopee/mappings.ts";
import { LazadaClient } from '../../packages/integrations/lazada/client.ts'
import { mapLazadaOrderToCanonical, mapLazadaItemsToCanonical } from "../../packages/integrations/lazada/mappings.ts";

/**
 * Runner function for marketplace sync jobs.
 * This is meant to be called on a schedule (pg_cron) or manually.
 */
serve(async (req) => {
  const supabase = getSupabaseClient()

  try {
    // 1. Pick a job to process
    const { data: job, error: pickError } = await supabase
      .from('marketplace_sync_jobs')
      .select('*, account:marketplace_accounts!inner(*)')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (pickError || !job) {
      return new Response(JSON.stringify({ message: 'No pending jobs found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 2. Mark job as processing
    await supabase
      .from('marketplace_sync_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', job.id)

    // 3. Resolve the job type
    console.log(`Processing job ${job.id} for provider ${job.account.provider_id}, type: ${job.job_type}`)
    
    let result: any = null;

    if (job.account.provider_id === 'shopee') {
      result = await handleShopeeJob(supabase, job);
    } else if (job.account.provider_id === 'lazada') {
      result = await handleLazadaJob(supabase, job);
    } else {
      throw new Error(`Unsupported provider: ${job.account.provider_id}`);
    }
    
    // 4. Complete the job
    await supabase
      .from('marketplace_sync_jobs')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString(),
        attempt_count: job.attempt_count + 1,
        payload: { ...job.payload, last_result: result }
      })
      .eq('id', job.id)

    return new Response(JSON.stringify({ success: true, job_id: job.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Job Runner Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

async function handleShopeeJob(supabase: any, job: any) {
  // 1. Get credentials (tokens)
  const { data: creds } = await supabase
    .from("marketplace_credentials")
    .select("*")
    .eq("account_id", job.account.id)
    .eq("is_active", true)
    .single();

  if (!creds) throw new Error("Missing active credentials for Shopee");

  const encryptionKey = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;
  const tokens = decryptJson<any>(creds.encrypted_payload, encryptionKey);

  // 2. Get Merchant Config (Partner ID/Key)
  const { data: config } = await supabase
    .from("merchant_shopee_config")
    .select("partner_id, partner_key")
    .eq("merchant_id", job.account.tenant_id)
    .single();

  const partnerId = config?.partner_id || Deno.env.get("SHOPEE_PARTNER_ID");
  const partnerKey = config?.partner_key || Deno.env.get("SHOPEE_PARTNER_KEY");

  if (!partnerId || !partnerKey) throw new Error("Shopee partner configuration missing for this merchant");

  const client = new ShopeeClient({
    partnerId: partnerId,
    partnerKey: partnerKey,
    baseUrl: Deno.env.get("SHOPEE_BASE_URL") || "https://partner.shopeemobile.com",
    accessToken: tokens.access_token,
    shopId: job.account.shop_id,
  });

  // 3. Dispatch based on job type
  switch (job.job_type) {
    case 'sync_orders':
      return await syncShopeeOrders(supabase, client, job);
    case 'sync_inventory':
      return await syncShopeeInventory(supabase, client, job);
    default:
      throw new Error(`Unsupported Shopee job type: ${job.job_type}`);
  }
}

async function syncShopeeOrders(supabase: any, client: ShopeeClient, job: any) {
  const timeFrom = job.payload?.time_from || Math.floor(Date.now() / 1000) - 86400; // Last 24h
  const timeTo = Math.floor(Date.now() / 1000);

  const orderList = await client.listOrders({ timeFrom, timeTo });
  const sns = orderList.response.order_list?.map((o: any) => o.order_sn) || [];

  if (sns.length > 0) {
    const details = await client.getOrderDetails(sns);
    for (const shopeeOrder of details.response.order_list || []) {
      const canonical = mapShopeeOrderToCanonical(shopeeOrder);
      
      // Upsert order in core orders table
      const { data: internalOrder, error: orderErr } = await supabase
        .from('orders')
        .upsert({
          tenant_id: job.tenant_id,
          external_id: canonical.external_order_id,
          total_amount: canonical.total_amount,
          status: 'pending',
          metadata: canonical.raw_payload
        })
        .select('id')
        .single();

      if (orderErr) {
        console.error(`Order upsert error for ${canonical.external_order_id}:`, orderErr);
        continue;
      }

      // Record mapping
      await supabase
        .from('marketplace_order_mappings')
        .upsert({
          tenant_id: job.tenant_id,
          account_id: job.account.id,
          order_id: internalOrder.id,
          external_order_id: canonical.external_order_id,
          external_order_sn: canonical.external_order_sn,
          raw_payload: canonical.raw_payload
        });
    }
  }

  return { order_count: sns.length };
}

async function syncShopeeInventory(supabase: any, client: ShopeeClient, job: any) {
  const { external_item_id, stock } = job.payload;
  if (!external_item_id || stock === undefined) throw new Error("Missing inventory payload");

  const result = await client.updateStock({
    itemId: parseInt(external_item_id),
    stock: stock
  });

  return result;
}

async function handleLazadaJob(supabase: any, job: any) {
  // 1. Get credentials
  const { data: creds } = await supabase
    .from("marketplace_credentials")
    .select("*")
    .eq("account_id", job.account.id)
    .eq("is_active", true)
    .single();

  if (!creds) throw new Error("Missing active credentials for Lazada");

  const encryptionKey = Deno.env.get("APP_ENCRYPTION_KEY_BASE64")!;
  const tokens = decryptJson<any>(creds.encrypted_payload, encryptionKey);

  const client = new LazadaClient({
    appKey: Deno.env.get("LAZADA_APP_KEY")!,
    appSecret: Deno.env.get("LAZADA_APP_SECRET")!,
    baseUrl: Deno.env.get("LAZADA_BASE_URL") || "https://api.lazada.com/rest",
    accessToken: tokens.access_token,
  });

  // 2. Dispatch based on job type
  switch (job.job_type) {
    case 'sync_orders':
      return await syncLazadaOrders(supabase, client, job);
    case 'sync_inventory':
      return await syncLazadaInventory(supabase, client, job);
    default:
      throw new Error(`Unsupported Lazada job type: ${job.job_type}`);
  }
}

async function syncLazadaOrders(supabase: any, client: LazadaClient, job: any) {
  const createdAfter = job.payload?.created_after || new Date(Date.now() - 86400 * 1000).toISOString();
  
  const orderRes = await client.listOrders({ created_after: createdAfter });
  const orders = orderRes.data?.orders || [];

  for (const lazadaOrder of orders) {
    const canonical = mapLazadaOrderToCanonical(lazadaOrder);
    
    // Fetch order items to complete the canonical object
    const itemsRes = await client.getOrderItems(lazadaOrder.order_id);
    const canonicalItems = mapLazadaItemsToCanonical(itemsRes.data || []);
    
    // Upsert order in core orders table
    const { data: internalOrder, error: orderErr } = await supabase
      .from('orders')
      .upsert({
        tenant_id: job.tenant_id,
        merchant_id: job.account.tenant_id,
        order_number: canonical.external_order_sn,
        total_amount: canonical.total_amount,
        status: 'pending',
        delivery_address: canonical.recipient_address,
        metadata: { ...canonical.raw_payload, items: itemsRes.data }
      })
      .select('id')
      .single();

    if (orderErr) {
      console.error(`Order upsert error for ${canonical.external_order_id}:`, orderErr);
      continue;
    }

    // Record mapping
    await supabase
      .from('marketplace_order_mappings')
      .upsert({
        tenant_id: job.tenant_id,
        account_id: job.account.id,
        order_id: internalOrder.id,
        external_order_id: canonical.external_order_id,
        external_order_sn: canonical.external_order_sn,
        raw_payload: canonical.raw_payload
      });
  }

  return { order_count: orders.length };
}

async function syncLazadaInventory(supabase: any, client: LazadaClient, job: any) {
  const { external_item_id, stock, seller_sku } = job.payload;
  if (!external_item_id || stock === undefined || !seller_sku) {
    throw new Error("Missing inventory payload (external_item_id, stock, seller_sku required)");
  }

  const result = await client.updateStock({
    ItemId: external_item_id,
    Skus: [{ SellerSku: seller_sku, Quantity: stock }]
  });

  return result;
}
