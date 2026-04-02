'use client'

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import toast from "react-hot-toast"
import { 
  Loader2, 
  Plus, 
  RefreshCw, 
  Trash2, 
  ExternalLink, 
  Store, 
  AlertTriangle,
  CheckCircle2,
  Globe,
  ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

export default function LazadaIntegrationPage() {
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<any[]>([])
  const [syncingId, setSyncingId] = useState<string | null>(null)
  
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get('success')

  useEffect(() => {
    fetchAccounts()
    if (success === 'true') {
      toast.success("Lazada account connected successfully!")
      // Clean up URL
      router.replace('/marketplace/lazada')
    }
  }, [success])

  const fetchAccounts = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: merchant } = await supabase
      .from("merchants")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (!merchant) return

    const { data, error } = await supabase
      .from("marketplace_accounts")
      .select("*")
      .eq("provider_id", "lazada")
      .eq("tenant_id", merchant.id)

    if (error) {
      toast.error("Failed to fetch Lazada accounts")
    } else {
      setAccounts(data || [])
    }
    setLoading(false)
  }

  const handleSync = async (accountId: string) => {
    setSyncingId(accountId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: merchant } = await supabase
        .from("merchants")
        .select("id")
        .eq("owner_id", user?.id)
        .single()

      if (!merchant) throw new Error("Merchant not found")

      // Queue a sync job
      const { error } = await supabase
        .from("marketplace_sync_jobs")
        .insert({
          tenant_id: merchant.id,
          account_id: accountId,
          job_type: "sync_orders",
          status: "pending",
          priority: 10
        })

      if (error) throw error
      toast.success("Sync job queued successfully")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this Lazada shop? This will not delete your Lazada data, but will stop syncing with our platform.")) {
      return
    }

    const { error } = await supabase
      .from("marketplace_accounts")
      .delete()
      .eq("id", id)

    if (error) {
      toast.error("Failed to disconnect account")
    } else {
      toast.success("Lazada account disconnected")
      fetchAccounts()
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <Store size={24} />
             </div>
             <h1 className="text-4xl font-black tracking-tight text-slate-900">Lazada Shop</h1>
          </div>
          <p className="text-slate-500 text-lg max-w-2xl font-medium">
            Manage your Lazada marketplace connections, sync inventory levels, and process orders in one place.
          </p>
        </div>
        <Link href="/marketplace/lazada/connect">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-14 rounded-2xl font-bold text-lg shadow-xl shadow-blue-100 group transition-all">
            <Plus className="mr-2 h-5 w-5 transition-transform group-hover:rotate-90" />
            Connect New Shop
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center bg-white/50 backdrop-blur-sm rounded-[2rem] border border-slate-100">
          <div className="flex flex-col items-center gap-4">
             <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
             <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading accounts...</p>
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-20 text-center border-dashed border-2 bg-slate-50/50 rounded-[3rem]">
          <div className="w-24 h-24 rounded-[2rem] bg-white shadow-sm flex items-center justify-center mb-8 border border-slate-100">
            <Globe className="h-12 w-12 text-slate-200" />
          </div>
          <CardTitle className="text-3xl font-black text-slate-900">No Lazada accounts found</CardTitle>
          <CardDescription className="max-w-md mt-4 text-slate-500 text-lg font-medium leading-relaxed">
            Connect your first Lazada shop to unlock automated inventory syncing and unified order management across all your channels.
          </CardDescription>
          <Link href="/marketplace/lazada/connect" className="mt-10">
            <Button size="lg" variant="default" className="bg-blue-600 hover:bg-blue-700 h-16 px-10 rounded-2xl text-lg font-bold shadow-2xl shadow-blue-100">
              Get Started Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className="group relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 rounded-[2.5rem] bg-white">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500" />
              
              <CardHeader className="relative pb-4 px-8 pt-8">
                <div className="flex items-start justify-between">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-3xl shadow-sm">
                    🔵
                  </div>
                  <Badge className={cn(
                    "rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest border-none shadow-sm",
                    account.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  )}>
                    {account.status}
                  </Badge>
                </div>
                <div className="mt-6">
                  <CardTitle className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                    {account.shop_name || "Lazada Shop"}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1.5 font-bold text-slate-400 mt-1 uppercase text-[10px] tracking-wider font-mono">
                    <Globe size={12} />
                    {account.region} / {account.site_code || 'MY'}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="relative px-8 pb-8 space-y-6">
                <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 grid grid-cols-2 gap-4">
                   <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shop ID</p>
                      <p className="font-bold text-slate-700 text-sm font-mono truncate">{account.shop_id}</p>
                   </div>
                   <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Connected Since</p>
                      <p className="font-bold text-slate-700 text-sm">{new Date(account.created_at).toLocaleDateString()}</p>
                   </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="default" 
                    className="flex-1 h-12 rounded-xl font-bold bg-slate-900 hover:bg-black text-white shadow-lg transition-all active:scale-95"
                    onClick={() => handleSync(account.id)}
                    disabled={syncingId === account.id}
                  >
                    {syncingId === account.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {syncingId === account.id ? 'Syncing...' : 'Sync Orders'}
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-12 w-12 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-100 transition-all active:scale-95"
                    onClick={() => handleDelete(account.id)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
                
                <Link href={`/marketplace/lazada/${account.id}`} className="block">
                  <Button variant="link" className="w-full text-slate-400 hover:text-blue-600 text-xs font-bold uppercase tracking-widest">
                    Manage Settings <ArrowRight size={12} className="ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Footer / Stats Section */}
      <div className="grid md:grid-cols-2 gap-8 pt-10">
         <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[2.5rem] text-white space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <CheckCircle2 className="text-blue-400" />
               </div>
               <h3 className="font-bold text-xl tracking-tight">System Status</h3>
            </div>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              All Lazada sync systems are currently operational. Real-time webhook notifications are active for all connected accounts.
            </p>
            <div className="flex items-center gap-2 pt-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Live & Synchronized</span>
            </div>
         </div>

         <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-white flex flex-col justify-center gap-4">
            <h3 className="font-bold text-slate-900 text-xl tracking-tight">Need advanced configuration?</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Customize how specific products map to Lazada categories or set up automatic price buffers.
            </p>
            <Button variant="outline" className="w-fit rounded-xl font-bold border-slate-200 hover:bg-slate-50 h-12 px-6">
               View Documentation
               <ExternalLink size={14} className="ml-2" />
            </Button>
         </Card>
      </div>
    </div>
  )
}
