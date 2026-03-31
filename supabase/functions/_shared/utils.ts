import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseWaitMs = 2000
): Promise<T> {
  let attempt = 1
  while (true) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error
      }
      const waitTime = baseWaitMs * Math.pow(2, attempt - 1)
      console.log(`Attempt ${attempt} failed. Retrying in ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      attempt++
    }
  }
}

/** Fetch wrapper that automatically retries on transient 502/503/504 gateway errors */
export async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  const delays = [0, 1000, 2000]
  let lastRes: Response | null = null
  for (let i = 0; i < maxAttempts; i++) {
    if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]))
    const res = await fetch(url, init)
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      lastRes = res
      console.warn(`[fetchWithRetry] Attempt ${i + 1} got HTTP ${res.status}, retrying...`)
      continue
    }
    return res
  }
  return lastRes!
}

export async function logLalamoveApi(
  supabase: any,
  orderId: string,
  details: {
    endpoint: string,
    method: string,
    requestBody?: any,
    responseBody?: any,
    statusCode: number,
    attempt: number
  }
) {
  try {
    // Redact sensitive headers or info if needed before stringifying
    let sanitizedRequest = null
    if (details.requestBody) {
      if (typeof details.requestBody === 'string') {
        try {
          sanitizedRequest = JSON.parse(details.requestBody)
        } catch {
          sanitizedRequest = { raw: details.requestBody }
        }
      } else {
        sanitizedRequest = details.requestBody
      }
    }
    
    await supabase.from('lalamove_api_log').insert({
      order_id: orderId,
      endpoint: details.endpoint,
      method: details.method,
      request_body: sanitizedRequest,
      response_body: details.responseBody,
      status_code: details.statusCode,
      attempt: details.attempt
    })
  } catch (e) {
    console.error('Failed to log Lalamove API call:', e)
  }
}

export function mapLalamoveStatus(lalamoveStatus: string, event: any = {}) {
  const updates: any = { updated_at: new Date().toISOString() }
  let callLoyalty = false

  switch (lalamoveStatus) {
    case 'ASSIGNING_DRIVER':
      updates.delivery_status = 'finding_driver'
      break

    case 'ON_GOING':
      updates.status = 'out_for_delivery'
      updates.delivery_status = 'in_transit'
      break

    case 'PICKED_UP':
      updates.status = 'out_for_delivery'
      updates.delivery_status = 'picked_up'
      break

    case 'COMPLETED':
      updates.status = 'delivered'
      updates.delivery_status = 'delivered'
      updates.delivered_at = new Date().toISOString()
      callLoyalty = true
      break

    case 'REJECTED':
    case 'EXPIRED':
      updates.exception_flag = 'driver_not_found'
      updates.exception_flagged_at = new Date().toISOString()
      updates.delivery_status = 'failed'
      break

    case 'CANCELLED':
      updates.status = 'confirmed'
      updates.lalamove_order_id = null
      updates.delivery_status = 'not_requested'
      updates.driver_name = null
      updates.driver_phone = null
      updates.driver_plate = null
      break
  }

  // Driver Info
  if (event.driverInfo) {
    updates.driver_name  = event.driverInfo.name
    updates.driver_phone = event.driverInfo.phone
    updates.driver_plate = event.driverInfo.plateNumber
    updates.delivery_status = 'driver_assigned'
  }

  // Driver GPS
  if (event.location) {
    updates.last_driver_lat = event.location.lat
    updates.last_driver_lng = event.location.lng
    updates.last_driver_update_at = new Date().toISOString()
  }

  return { updates, callLoyalty }
}
