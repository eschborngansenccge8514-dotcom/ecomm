'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getMerchantId(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!merchant) throw new Error('Merchant not found')
  return merchant.id
}

export async function getTransfers() {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('stock_transfers')
    .select('*, from:pos_outlets!from_outlet_id(name), to:pos_outlets!to_outlet_id(name)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getTransfer(id: string) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('stock_transfers')
    .select('*, from:pos_outlets!from_outlet_id(*), to:pos_outlets!to_outlet_id(*), stock_transfer_items(*, products(name))')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single()

  if (error) throw error
  return data
}

export async function createTransfer(params: {
  fromOutletId: string
  toOutletId: string
  notes?: string
  items: Array<{
    productId: string
    variantId?: string
    quantity: number
  }>
}) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data: transferNumber, error: trfError } = await supabase.rpc('generate_transfer_number', { p_merchant_id: merchantId })
  if (trfError) throw trfError

  const { data: transfer, error: createError } = await supabase
    .from('stock_transfers')
    .insert({
      merchant_id: merchantId,
      transfer_number: transferNumber,
      from_outlet_id: params.fromOutletId,
      to_outlet_id: params.toOutletId,
      notes: params.notes,
      status: 'draft'
    })
    .select()
    .single()

  if (createError) throw createError

  const { error: itemsError } = await supabase
    .from('stock_transfer_items')
    .insert(params.items.map(i => ({
      transfer_id: transfer.id,
      product_id: i.productId,
      variant_id: i.variantId || null,
      quantity: i.quantity
    })))

  if (itemsError) throw itemsError

  revalidatePath('/inventory/transfers')
  return transfer
}

export async function shipTransfer(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('execute_transfer_ship', { p_transfer_id: id })
  if (error) throw error
  revalidatePath('/inventory/transfers')
}

export async function receiveTransfer(id: string, items: Array<{ item_id: string, quantity_received: number }>) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('execute_transfer_receive', { p_transfer_id: id, p_items: items })
  if (error) throw error
  revalidatePath('/inventory/transfers')
}

export async function cancelTransfer(id: string) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { error } = await supabase
    .from('stock_transfers')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('merchant_id', merchantId)

  if (error) throw error
  revalidatePath('/inventory/transfers')
}
