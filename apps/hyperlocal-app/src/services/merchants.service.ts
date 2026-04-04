import { supabase } from '@/lib/supabase'
import type { InsertMerchant, Merchant } from '@/types/app.types'

export const merchantsService = {
  // Browse active merchants near a postcode
  async getAll(postcode?: string): Promise<Merchant[]> {
    let query = supabase
      .from('merchants')
      .select('*, average_rating, review_count')
      .eq('status', 'active')
      .order('average_rating', { ascending: false })

    if (postcode) {
      query = query.eq('postcode', postcode)
    }

    const { data, error } = await query
    if (error) throw error
    return (data as any) as Merchant[]
  },

  // Get a single store by slug (for store detail page)
  async getBySlug(slug: string): Promise<Merchant | null> {
    const { data, error } = await supabase
      .from('merchants')
      .select(`
        *,
        average_rating,
        review_count,
        operating_hours:merchant_operating_hours(*),
        announcements:store_announcements(*)
      `)
      .eq('store_slug', slug)
      .eq('status', 'active')
      .maybeSingle()
    if (error) return null
    return (data as any) as Merchant
  },

  // Merchant self-registration
  async create(payload: InsertMerchant): Promise<Merchant> {
    const { data, error } = await supabase
      .from('merchants')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return (data as any) as Merchant
  },

  // Update merchant profile
  async update(id: string, payload: Partial<InsertMerchant>): Promise<Merchant> {
    const { data, error } = await supabase
      .from('merchants')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return (data as any) as Merchant
  },

  // Check if slug is available
  async isSlugAvailable(slug: string): Promise<boolean> {
    const { count } = await supabase
      .from('merchants')
      .select('id', { count: 'exact', head: true })
      .eq('store_slug', slug)
    return count === 0
  },
}
