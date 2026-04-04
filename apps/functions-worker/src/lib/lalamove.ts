export async function buildLalamoveHeaders(
  apiKey:    string,
  apiSecret: string,
  method:    string,
  path:      string,
  body:      string = '',
  market:    string = 'MY'
): Promise<HeadersInit> {
  const timestamp = String(Date.now())

  // Lalamove v3 signature format:
  // {timestamp}\r\n{METHOD}\r\n{path}\r\n\r\n{body}
  const rawSignature = `${timestamp}\r\n${method.toUpperCase()}\r\n${path}\r\n\r\n${body}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawSignature))
  const signature = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')

  return {
    'Authorization': `hmac ${apiKey}:${timestamp}:${signature}`,
    'Content-Type':  'application/json',
    'Market':        market,
    'Accept':        'application/json',
  }
}

export function getLalamoveBaseUrl(env: string): string {
  return env === 'production'
    ? 'https://rest.lalamove.com'
    : 'https://rest.sandbox.lalamove.com'
}

export function getLalamoveErrorMessage(data: any, defaultMsg: string): string {
  if (!data) return defaultMsg
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors[0].message || data.errors[0].id || defaultMsg
  }
  return data.message || data.error?.message || defaultMsg
}

export function normPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return trimmed
  if (trimmed.startsWith('60')) return '+' + trimmed
  if (trimmed.startsWith('0')) return '+60' + trimmed.slice(1)
  return null
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
      updates.status = 'confirmed'
      updates.delivery_status = 'driver_assigned'
      break

    case 'PICKED_UP':
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

  if (event.location) {
    updates.last_driver_lat = event.location.lat
    updates.last_driver_lng = event.location.lng
    updates.last_driver_update_at = event.location.updatedAt || new Date().toISOString()
  }

  if (event.shareLink) {
    updates.delivery_tracking_url = event.shareLink
  }

  const deliveryMetadata: any = {}
  if (event.distance) deliveryMetadata.distance = event.distance
  if (event.priceBreakdown) deliveryMetadata.priceBreakdown = event.priceBreakdown
  if (event.stops) deliveryMetadata.stops = event.stops
  if (event.metadata) deliveryMetadata.lalamove_client_metadata = event.metadata

  if (Object.keys(deliveryMetadata).length > 0) {
    const recipientStop = event.stops?.[1] || event.order?.stops?.[1]
    if (recipientStop?.pod) deliveryMetadata.pod = recipientStop.pod
    updates.delivery_metadata = { lalamove: deliveryMetadata }
  }

  return { updates, callLoyalty }
}

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
