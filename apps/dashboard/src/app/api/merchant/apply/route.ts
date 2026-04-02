import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { STORE_TYPES, type StoreType } from '@/lib/store-types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { userId, storeName, storeType, tagline, description, fullName, phone, whatsapp,
    city, state, postcode, businessRegNumber, bankName, bankAccountNumber, bankAccountName,
    expectedOrders, howHeard, agreeTerms } = body

  if (!userId || !storeName || !storeType || !agreeTerms || !postcode)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  // Update profile
  await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', userId)

  // Save application
  const { error: appErr } = await supabase.from('merchant_applications').upsert({
    user_id: userId,
    store_name: storeName,
    store_type: storeType,
    tagline,
    description,
    phone,
    whatsapp,
    city,
    state,
    postcode,
    business_reg_number: businessRegNumber,
    bank_name: bankName,
    bank_account_number: bankAccountNumber,
    bank_account_name: bankAccountName,
    expected_orders: expectedOrders,
    how_heard: howHeard,
    agree_terms: agreeTerms,
    status: 'pending',
  }, { onConflict: 'user_id' })
  if (appErr) return NextResponse.json({ error: appErr.message }, { status: 400 })

  // Create merchant record (status = pending_review)
  // Note: we use 'pending_review' to match the enum in the database schema
  const industry = STORE_TYPES[storeType as StoreType]?.label || 'General Retail'
  const slug = storeName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  
  const { error: merchantErr } = await supabase.from('merchants').upsert({
    owner_id:        userId, 
    store_name:      storeName,
    store_type:      storeType,
    industry:        industry,
    store_slug:      slug,
    status:          'pending_review',
    is_published:    false,
    city:            city,
    state:           state,
    postcode:        postcode,
    appearance:      { tagline },
    store_config:    { phone, whatsapp, city, state },
    bank_name:       bankName,
    bank_account_number: bankAccountNumber,
    bank_account_name:   bankAccountName,
    onboarding_step: 0,
    onboarding_completed: false,
  }, { onConflict: 'owner_id' })
  if (merchantErr) return NextResponse.json({ error: merchantErr.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
