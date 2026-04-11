import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function testAuditTrail() {
  console.log('Testing Audit Trail...')
  
  // 1. Get a product
  const { data: product } = await supabase.from('products').select('*').limit(1).single()
  if (!product) {
    console.log('No products found to test.')
    return
  }
  
  console.log(`Updating product: ${product.name}`)
  
  // 2. Update it
  const { error } = await supabase
    .from('products')
    .update({ name: product.name + ' (Updated)' })
    .eq('id', product.id)
  
  if (error) {
    console.error('Update failed:', error)
    return
  }
  
  console.log('Update successful. Checking audit logs...')
  
  // 3. Wait a bit for trigger
  await new Promise(r => setTimeout(r, 2000))
  
  // 4. Check audit logs
  const { data: logs, error: logError } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('record_id', product.id)
    .order('created_at', { ascending: false })
  
  if (logError) {
    console.error('Failed to fetch logs:', logError)
    return
  }
  
  if (logs && logs.length > 0) {
    console.log('Audit log found!')
    console.log(JSON.stringify(logs[0], null, 2))
  } else {
    console.log('No audit log found for this change.')
  }
}

testAuditTrail()
