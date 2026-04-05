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

export async function getSuppliers() {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

export async function getSupplier(id: string) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single()

  if (error) throw error
  return data
}

export async function createSupplier(params: {
  name: string
  code: string
  email?: string
  phone?: string
  address?: any
  contactPerson?: string
  paymentTerms?: string
  leadTimeDays?: number
  notes?: string
}) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      merchant_id: merchantId,
      name: params.name,
      code: params.code,
      email: params.email,
      phone: params.phone,
      address: params.address,
      contact_person: params.contactPerson,
      payment_terms: params.paymentTerms,
      lead_time_days: params.leadTimeDays,
      notes: params.notes
    })
    .select()
    .single()

  if (error) throw error
  revalidatePath('/inventory/suppliers')
  return data
}

export async function updateSupplier(id: string, params: any) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('suppliers')
    .update({
      ...params,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/inventory/suppliers')
  return data
}

export async function deleteSupplier(id: string) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchantId)

  if (error) throw error
  revalidatePath('/inventory/suppliers')
}

export async function getProductSuppliers(productId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product_suppliers')
    .select('*, suppliers(name)')
    .eq('product_id', productId)

  if (error) throw error
  return data
}

export async function linkProductSupplier(params: {
  productId: string
  variantId?: string | null
  supplierId: string
  supplierSku?: string
  unitCost: number
  minOrderQty?: number
  isPreferred?: boolean
}) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('product_suppliers')
    .upsert({
      merchant_id: merchantId,
      product_id: params.productId,
      variant_id: params.variantId || null,
      supplier_id: params.supplierId,
      supplier_sku: params.supplierSku,
      unit_cost: params.unitCost,
      min_order_qty: params.minOrderQty || 1,
      is_preferred: params.isPreferred || false,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error
  revalidatePath('/inventory/suppliers')
  return data
}

export async function unlinkProductSupplier(id: string) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { error } = await supabase
    .from('product_suppliers')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchantId)

  if (error) throw error
  revalidatePath('/inventory/suppliers')
}
