import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function debug() {
  const { data: pos, error } = await supabase
    .from('purchase_orders')
    .select('id, po_number, supplier_id, supplier:suppliers(name)')
    .limit(5)

  if (error) console.error(error)
  console.log(JSON.stringify(pos, null, 2))
}

debug()
