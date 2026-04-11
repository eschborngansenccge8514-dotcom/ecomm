import { createClient } from '@/lib/supabase/server'
import { ReconcileClient } from './_components/ReconcileClient'

export default async function ReconcilePage() {
  const supabase = await createClient()
  
  // Parallel fetch: User, Linked Bank Accounts, and ALL COA accounts for manual posting
  const [{ data: { user } }, { data: linkedAccounts }, { data: coaAll }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('bank_accounts')
      .select('*, coa_accounts(name, code)')
      .eq('is_active', true),
    supabase.from('coa_accounts')
      .select('*')
      .eq('is_active', true)
      .order('code', { ascending: true })
  ])

  let accounts = linkedAccounts || []

  // Fallback: If no bank_accounts records exist, look for COA accounts starting with "11" (Cash & Bank)
  if (accounts.length === 0 && user) {
    const { data: coaAccounts } = await supabase
      .from('coa_accounts')
      .select('*')
      .ilike('code', '11%')
      .eq('is_active', true)
      
    if (coaAccounts) {
      accounts = coaAccounts.map(coa => ({
        id: `coa-${coa.id}`,
        name: coa.name,
        merchant_id: coa.merchant_id, // Added this
        coa_account_id: coa.id,
        coa_accounts: coa
      }))
    }
  }

  if (!user) return null

  // 2. Fetch Pending Statement Lines (First account by default if any)
  const defaultAccountId = accounts?.[0]?.id
  let pendingLines: any[] = []
  
  if (defaultAccountId) {
    const { data } = await supabase
      .from('bank_statement_lines')
      .select('*')
      .eq('bank_account_id', defaultAccountId)
      .eq('status', 'pending')
      .order('transaction_date', { ascending: true })
    pendingLines = data || []
  }

  // 3. Fetch potential GL matches (Recent Journal Entries or Invoices)
  // For simplicity, we'll fetch them on the client as-needed or pass initial few
  
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Bank Reconciliation</h1>
        <p className="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest">Merge your bank statements with the digital ledger</p>
      </div>

      <ReconcileClient 
        initialAccounts={accounts || []} 
        initialLines={pendingLines}
        coaAccounts={coaAll || []}
      />
    </div>
  )
}
