import { supabase } from '@/lib/supabase'

export const paymentService = {
  createRazorpayOrder: async (orderId: string) => {
    // Using native fetch as a fallback if invoke hangs
    const { data: { session } } = await supabase.auth.getSession()
    const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-razorpay-order`
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ orderId }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Server error')
      }

      return await response.json() as {
        razorpayOrderId: string
        razorpayKeyId:   string
        amount:          number
        currency:        string
        orderNumber:     string
      }
    } catch (e: any) {
      console.error('paymentService.createRazorpayOrder ERROR:', e)
      throw e
    }
  },

  verifyRazorpayPayment: async (params: {
    orderId:           string
    razorpayPaymentId: string
    razorpayOrderId:   string
    razorpaySignature: string
  }) => {
    const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
      body: params,
    })
    if (error) throw new Error(error.message)
    return data as { success: boolean }
  },

  createBillplzBill: async (orderId: string) => {
    const { data, error } = await supabase.functions.invoke('create-billplz-bill', {
      body: { orderId },
    })
    if (error) throw new Error(error.message)
    return data as { billUrl: string; billId: string }
  },
}
