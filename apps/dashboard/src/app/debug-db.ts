import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function test() {
  const { data: merchants } = await supabase.from('merchants').select('id, name').limit(1)
  if (!merchants?.length) return console.log('No merchants found')
  
  const mId = merchants[0].id
  console.log('Testing for Merchant:', merchants[0].name, mId)

  const { data: count, error: countError } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', mId)
    
  console.log('Customer count for merchant:', count?.length || 0)
  if (countError) console.error('Count Error:', countError)

  const { data: anyCustomers } = await supabase.from('customers').select('*').limit(5)
  console.log('Sample customers in DB (any merchant):', anyCustomers?.length || 0)
  if (anyCustomers?.length) {
    console.log('First customer merchant_id:', anyCustomers[0].merchant_id)
  }
}

test()
