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
export async function fetchWithRetry(
  url: string, 
  init: RequestInit, 
  maxAttempts = 3
): Promise<{ res: Response, attempts: number }> {
  const delays = [0, 1000, 2000]
  let lastRes: Response | null = null
  for (let i = 0; i < maxAttempts; i++) {
    if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]))
    
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 15000) // 15s timeout

    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(id)
      
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        lastRes = res
        console.warn(`[fetchWithRetry] Attempt ${i + 1} got HTTP ${res.status}, retrying...`)
        continue
      }
      return { res, attempts: i + 1 }
    } catch (err: any) {
      clearTimeout(id)
      if (err.name === 'AbortError') {
        console.error(`[fetchWithRetry] Attempt ${i + 1} timed out`)
      } else {
        console.error(`[fetchWithRetry] Attempt ${i + 1} failed:`, err.message)
      }
      if (i === maxAttempts - 1) throw err
      continue
    }
  }
  return { res: lastRes!, attempts: maxAttempts }
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
      updates.status = 'confirmed'
      updates.delivery_status = 'finding_driver'
      break

    case 'ON_GOING':
      // Status remains 'confirmed' because driver is just accepted/assigned
      updates.status = 'confirmed'
      updates.delivery_status = 'driver_assigned'
      break

    case 'PICKED_UP':
      // Status moves to 'out_for_delivery' once driver is in possession of items
      updates.status = 'out_for_delivery'
      updates.delivery_status = 'picked_up'
      updates.dispatched_at = new Date().toISOString()
      break

    case 'COMPLETED':
    case 'DELIVERED':
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
    case 'CANCELED':
      updates.status = 'confirmed'
      updates.lalamove_order_id = null
      updates.delivery_status = 'not_requested'
      updates.driver_name = null
      updates.driver_phone = null
      updates.driver_plate = null
      updates.driver_photo_url = null
      break
  }

  // Driver GPS (If provided in the main response/webhook)
  if (event.location) {
    updates.last_driver_lat = event.location.lat
    updates.last_driver_lng = event.location.lng
    updates.last_driver_update_at = event.location.updatedAt || new Date().toISOString()
  }

  // Extra Details (Lalamove v3 Details)
  if (event.shareLink) {
    updates.delivery_tracking_url = event.shareLink
  }

  const deliveryMetadata: any = {}
  if (event.distance) deliveryMetadata.distance = event.distance
  if (event.priceBreakdown) deliveryMetadata.priceBreakdown = event.priceBreakdown
  if (event.stops) deliveryMetadata.stops = event.stops
  if (event.metadata) deliveryMetadata.lalamove_client_metadata = event.metadata

  if (Object.keys(deliveryMetadata).length > 0) {
    // Merge POD into metadata if available
    const recipientStop = event.stops?.[1] || event.order?.stops?.[1]
    if (recipientStop?.pod) {
      deliveryMetadata.pod = recipientStop.pod
    }
    updates.delivery_metadata = { lalamove: deliveryMetadata }
  } else {
     // If no other metadata, still check for POD
     const recipientStop = event.stops?.[1] || event.order?.stops?.[1]
     if (recipientStop?.pod) {
       updates.delivery_metadata = { lalamove: { pod: recipientStop.pod } }
     }
  }

  return { updates, callLoyalty }
}

/**
 * Maps Lalamove v3 dedicated Driver Details response to database updates.
 */
export function mapLalamoveDriverInfo(driver: any) {
  if (!driver) return {}

  const updates: any = {
    driver_name:  driver.name,
    driver_phone: driver.phone,
    driver_plate: driver.plateNumber,
    driver_photo_url: driver.photo,
  }

  if (driver.coordinates) {
    updates.last_driver_lat = driver.coordinates.lat
    updates.last_driver_lng = driver.coordinates.lng
    updates.last_driver_update_at = driver.coordinates.updatedAt || new Date().toISOString()
  }

  return updates
}

/**
 * Extracts a human-readable error message from a Lalamove response body.
 * Handles both single message fields and the Lalamove v3 errors array.
 */
export function getLalamoveErrorMessage(data: any, defaultMsg: string): string {
  if (!data) return defaultMsg
  
  // v3 error format: { errors: [ { id: "...", message: "..." } ] }
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors[0].message || data.errors[0].id || defaultMsg
  }
  
  // Legacy / Other formats
  return data.message || data.error?.message || defaultMsg
}
