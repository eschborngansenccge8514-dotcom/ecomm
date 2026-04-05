import { invokeWorker } from '@/lib/worker'

export const paymentService = {
  createRazorpayOrder: async (orderId: string) => {
    // Use explicit path to avoid hyphen-to-slash conversion in invokeWorker
    const { data, error } = await invokeWorker('razorpay/create-order', {
      body: { orderId },
    })
    if (error || data?.error) throw new Error(error?.message ?? data?.error)
    return data as {
      razorpayOrderId: string
      razorpayKeyId:   string
      amount:          number
      currency:        string
      orderNumber:     string
    }
  },

  verifyRazorpayPayment: async (params: {
    orderId:           string
    razorpayPaymentId: string
    razorpayOrderId:   string
    razorpaySignature: string
  }) => {
    const { data, error } = await invokeWorker('razorpay/verify-payment', {
      body: params,
    })
    if (error || data?.error) throw new Error(error?.message ?? data?.error)
    return data as { success: boolean }
  },

  createBillplzBill: async (orderId: string) => {
    const { data, error } = await invokeWorker('billplz/create-bill', {
      body: { orderId },
    })
    if (error || data?.error) throw new Error(error?.message ?? data?.error)
    return data as { billUrl: string; billId: string }
  },
}
