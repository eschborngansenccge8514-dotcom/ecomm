import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from dashboard correctly
dotenv.config({ path: path.resolve(__dirname, 'apps/dashboard/.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testResolution(id: string) {
  console.log(`\nTesting resolution for: ${id}`)
  
  // Try owner_id
  const { data: m1 } = await supabase
    .from('merchants')
    .select('owner_id, store_name')
    .eq('owner_id', id)
    .maybeSingle()

  if (m1) {
    console.log(`MATCH owner_id: ${m1.store_name} (${m1.owner_id})`)
    return
  }

  // Try id
  const { data: m2 } = await supabase
    .from('merchants')
    .select('owner_id, store_name')
    .eq('id', id)
    .maybeSingle()

  if (m2) {
    console.log(`MATCH id (UUID): ${m2.store_name} -> Resolved to owner_id: ${m2.owner_id}`)
  } else {
    console.log('NO MATCH FOUND')
  }
}

async function run() {
  // Test with a known merchant UUID (from prev logs if any)
  // Or just verify the logic works if we can find one merchant
  const { data: anyMerchant } = await supabase.from('merchants').select('id, owner_id').limit(1).single()
  
  if (anyMerchant) {
    await testResolution(anyMerchant.owner_id) // Test User ID
    await testResolution(anyMerchant.id)       // Test Merchant UUID
  } else {
    console.log('No merchants found in DB to test with.')
  }
}

run().catch(console.error)
