import { invokeWorker } from '@/lib/worker'

export type LalamoveQuote = {
  serviceType:   string
  label:         string
  emoji:         string
  description:   string
  maxKg:         number
  available:     boolean
  quotationId:   string
  totalPrice:    string
  currency:      string
  expiresAt:     string
}

export type EasyParcelRate = {
  rateId:        string
  serviceId:     string
  courierId:     string
  courierName:   string
  courierLogo:   string
  serviceName:   string
  serviceDetail: string
  price:         number
  delivery:      string
  pickupDate:    string
  weightKg:      number
}

// Edge functions return errors as { error: "..." } with HTTP 200.
// This helper throws for both SDK-level errors and body-level errors.
function check(data: any, error: any) {
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

export const deliveryService = {
  getLalamoveQuotes: async (orderId: string): Promise<LalamoveQuote[]> => {
    const { data, error } = await invokeWorker('lalamove/quote', {
      body: { orderId },
    })
    return check(data, error).quotes ?? []
  },

  bookLalamove: async (orderId: string, quotationId: string, serviceType: string) => {
    const { data, error } = await invokeWorker('lalamove/create-order', {
      body: { orderId, quotationId, serviceType },
    })
    return check(data, error) as { success: boolean; lalamoveOrderId: string }
  },

  getEasyParcelRates: async (orderId: string): Promise<{ rates: EasyParcelRate[]; weightKg: number }> => {
    const { data, error } = await invokeWorker('easyparcel-rate-check', {
      body: { orderId },
    })
    return check(data, error)
  },

  bookEasyParcel: async (orderId: string, serviceId: string, weightKg: number) => {
    const { data, error } = await invokeWorker('easyparcel-create-order', {
      body: { orderId, serviceId, weightKg },
    })
    return check(data, error) as { success: boolean; orderNo: string; awb: string; trackingUrl: string }
  },
}
