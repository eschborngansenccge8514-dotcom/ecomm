import { createClient } from '../../lib/supabase/server'

async function checkTables() {
  const supabase = await createClient()
  
  console.log('--- Database Schema Check ---')
  
  const { data, error } = await supabase.rpc('get_table_names') // If RPC exists
  
  if (error) {
    // Fallback: try to select from information_schema
    const { data: tables, error: infoError } = await supabase
      .from('coa_accounts') // known table
      .select('count') // just to check connection
      
    console.log('Connection to coa_accounts:', infoError ? 'FAILED' : 'SUCCESS')
    
    // Check bank_accounts specifically
    const { error: bankError } = await supabase.from('bank_accounts').select('id').limit(1)
    console.log('bank_accounts check error:', bankError)
    
    const { error: bankSingleError } = await supabase.from('bank_account').select('id').limit(1)
    console.log('bank_account (singular) check error:', bankSingleError)
  }
}

checkTables()
