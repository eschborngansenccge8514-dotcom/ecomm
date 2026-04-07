import { getAuthContext } from '@/lib/utils.server'
import { WalletClient }    from './_components/WalletClient'
import { redirect }        from 'next/navigation'

export default async function WalletPage() {
  const { supabase, user, merchant } = await getAuthContext()

  if (!merchant) {
    redirect('/')
  }

  // Fetch wallet, transactions, and withdrawal requests
  const [
    { data: wallet },
    { data: transactions },
    { data: withdrawalRequests }
  ] = await Promise.all([
    supabase
      .from('merchant_wallets')
      .select('*')
      .eq('merchant_id', merchant.id)
      .single(),
    supabase
      .from('wallet_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(20)
  ])

  // Get full merchant details for bank info
  const { data: fullMerchant } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', merchant.id)
    .single()

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Merchant Wallet</h1>
        <p className="text-gray-500 font-medium">Manage your earnings and withdrawal requests</p>
      </div>

      <WalletClient 
        wallet={wallet} 
        transactions={transactions ?? []} 
        withdrawalRequests={withdrawalRequests ?? []}
        merchant={fullMerchant}
      />
    </div>
  )
}
