import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function inspectFunction() {
  const { data, error } = await supabase.rpc('get_reorder_suggestions_def', {}) // I don't have this RPC
  // Instead I'll use pg_proc
  const { data: proc, error: procError } = await supabase.from('pg_proc').select('prosrc').eq('proname', 'get_reorder_suggestions').single()
}
