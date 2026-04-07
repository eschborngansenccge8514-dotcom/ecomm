import { invokeWorker } from '@/lib/worker'

function buildAddressString(parts: {
  line1: string; line2?: string | null
  city: string; state: string; postcode: string
  country?: string
}): string {
  return [
    parts.line1,
    parts.line2,
    parts.city,
    parts.state,
    parts.postcode,
    parts.country ?? 'Malaysia',
  ].filter(Boolean).join(', ')
}

export const geocodingService = {
  // Geocode a customer address row and store lat/lng back into DB
  geocodeAddress: async (addressId: string, address: {
    address_line1: string; address_line2?: string | null
    city: string; state: string; postcode: string
  }): Promise<{ lat: number; lng: number } | null> => {
    try {
      const addressString = buildAddressString({
        line1:   address.address_line1,
        line2:   address.address_line2,
        city:    address.city,
        state:   address.state,
        postcode: address.postcode,
      })
      const { data, error } = await invokeWorker('geocode-address', {
        body: { type: 'address', id: addressId, addressString },
      })
      if (error || data?.error) {
        console.warn('Geocode address failed:', error?.message ?? data?.error)
        return null
      }
      return data
    } catch (e: any) {
      console.warn('Geocoding service error:', e.message)
      return null
    }
  },

  // Geocode a merchant store address and store lat/lng back into DB
  geocodeMerchant: async (merchantId: string, address: {
    address_line1: string; city: string; state: string; postcode: string
  }): Promise<{ lat: number; lng: number } | null> => {
    try {
      const addressString = buildAddressString({
        line1:    address.address_line1,
        city:     address.city,
        state:    address.state,
        postcode: address.postcode,
      })
      const { data, error } = await invokeWorker('geocode-address', {
        body: { type: 'merchant', id: merchantId, addressString },
      })
      if (error || data?.error) {
        console.warn('Geocode merchant failed:', error?.message ?? data?.error)
        return null
      }
      return data
    } catch (e: any) {
      console.warn('Geocoding service error:', e.message)
      return null
    }
  },

  buildAddressString,
}
