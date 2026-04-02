import { supabase } from '@/lib/supabase'
import type { InsertProduct, ProductWithVariants, UpdateProduct } from '@/types/app.types'

export const productsService = {
  // Get all products for a merchant (customer view — active only)
  async getByMerchant(merchantId: string): Promise<ProductWithVariants[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*), category:categories(*)')
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ProductWithVariants[]
  },

  // Get all products for a merchant (merchant view — all statuses)
  async getByMerchantOwner(merchantId: string): Promise<ProductWithVariants[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*), category:categories(*)')
      .eq('merchant_id', merchantId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ProductWithVariants[]
  },

  // Get single product
  async getById(id: string): Promise<ProductWithVariants | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*), category:categories(*)')
      .eq('id', id)
      .single()
    if (error) return null
    return data as ProductWithVariants
  },

  async create(payload: InsertProduct): Promise<ProductWithVariants> {
    const { data, error } = await supabase
      .from('products')
      .insert(payload)
      .select('*, variants:product_variants(*), category:categories(*)')
      .single()
    if (error) throw error
    return data as ProductWithVariants
  },

  async update(id: string, payload: UpdateProduct): Promise<ProductWithVariants> {
    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select('*, variants:product_variants(*), category:categories(*)')
      .single()
    if (error) throw error
    return data as ProductWithVariants
  },

  // Soft delete
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ status: 'deleted' })
      .eq('id', id)
    if (error) throw error
  },
}
