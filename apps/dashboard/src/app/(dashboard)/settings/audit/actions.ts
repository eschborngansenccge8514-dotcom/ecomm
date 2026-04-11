'use server'

import { createClient } from '@/lib/supabase/server'

export async function getAuditLogs() {
  const supabase = await createClient()
  
  // Verify auth first
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.warn('Audit: No user found in session')
    return []
  }

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, table_name, record_id, created_at, changed_fields, old_data, new_data')
    .order('created_at', { ascending: false })
    .limit(40) // Reduced limit for faster initial load
    
  if (error) {
    console.error('Audit Fetch Error Detail:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    return []
  }
  
  return data || []
}
