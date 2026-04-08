'use client'

import { useState, useMemo, useEffect } from 'react'
import { 
  Package, Search, Clock, CheckCircle2, 
  ChevronRight, Printer, QrCode, Truck,
  AlertCircle, Loader2, FileText
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  updateFulfilmentStatus,
  verifyPickByBarcode,
  getFulfilments
} from '@/lib/fulfilment-actions'
import { printPickList, printPackingSlip } from '@/lib/fulfilment-print'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface FulfilmentClientProps {
  initialFulfilments: any[]
}

export function FulfilmentClient({ initialFulfilments }: FulfilmentClientProps) {
  const router = useRouter()
  const [fulfilments, setFulfilments] = useState(initialFulfilments)
  useEffect(() => { setFulfilments(initialFulfilments) }, [initialFulfilments])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [scanningFor, setScanningFor] = useState<string | null>(null) // fulfilmentId
  const [barcodeInput, setBarcodeInput] = useState('')

  const filtered = useMemo(() => {
    return fulfilments.filter(f => {
      const matchSearch = f.fulfilment_number.toLowerCase().includes(search.toLowerCase()) || 
                          f.order?.order_number?.toLowerCase().includes(search.toLowerCase()) ||
                          f.order?.buyer_name?.toLowerCase().includes(search.toLowerCase())
      
      const matchStatus = statusFilter === 'all' || f.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [fulfilments, search, statusFilter])

  const handleUpdateStatus = async (id: string, status: string) => {
    // Optimistic update
    setFulfilments(prev => prev.map(f => f.id === id ? { ...f, status } : f))
    try {
      await updateFulfilmentStatus(id, status)
      toast.success(`Status updated to ${status}`)
      router.refresh()
    } catch (err: any) {
      // Revert on failure
      setFulfilments(initialFulfilments)
      toast.error(err.message)
    }
  }

  const handleScanBarcode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scanningFor || !barcodeInput) return

    try {
      const res = await verifyPickByBarcode(scanningFor, barcodeInput)
      if (res.success) {
        toast.success('Item verified!')
        setBarcodeInput('')
        // Refresh local items
        setFulfilments(prev => prev.map(f => {
          if (f.id === scanningFor) {
            return {
              ...f,
              fulfilment_items: f.fulfilment_items.map((item: any) => 
                item.barcode === barcodeInput ? { ...item, picked: true } : item
              )
            }
          }
          return f
        }))
      } else {
        toast.error(res.message || 'Verification failed')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const stats = {
    pending: fulfilments.filter(f => f.status === 'pending').length,
    picking: fulfilments.filter(f => f.status === 'picking' || f.status === 'picked').length,
    packing: fulfilments.filter(f => f.status === 'packing').length,
    packed: fulfilments.filter(f => f.status === 'packed').length,
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
            <Clock size={20} />
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.pending}</p>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Pending</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
            <Package size={20} />
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.picking}</p>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Picking</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-4">
            <AlertCircle size={20} />
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.packing}</p>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Packing</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 mb-4">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.packed}</p>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Ready to Ship</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input 
            placeholder="Search fulfilment #, order #, or customer..." 
            className="pl-10 h-11 bg-gray-50/50 border-0 rounded-2xl focus-visible:ring-blue-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {['all', 'pending', 'picking', 'picked', 'packing', 'packed'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                statusFilter === status 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filtered.map(f => (
          <div key={f.id} className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400">
                    <Package size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 leading-tight">{f.fulfilment_number}</h3>
                    <p className="text-xs font-bold text-blue-600">Order {f.order?.order_number}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                    f.status === 'pending'  ? "bg-amber-100  text-amber-700"  :
                    f.status === 'picking'  ? "bg-blue-100   text-blue-700"   :
                    f.status === 'picked'   ? "bg-indigo-100 text-indigo-700" :
                    f.status === 'packing'  ? "bg-purple-100 text-purple-700" :
                    f.status === 'packed'   ? "bg-green-100  text-green-700"  :
                    f.status === 'shipped'  ? "bg-cyan-100   text-cyan-700"   :
                    "bg-gray-100 text-gray-500"
                  )}>
                    {f.status}
                  </span>
                  <p className="text-[10px] text-gray-300 mt-1 font-bold">
                    {format(new Date(f.created_at), 'd MMM, h:mm a')}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-900">{f.order?.buyer_name}</span>
                  <span className="text-gray-400 text-xs">{f.fulfilment_items.length} items</span>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {f.fulfilment_items.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{item.variant?.name || item.product?.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{item.variant?.sku || item.product?.sku}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-black text-gray-900">×{item.quantity}</span>
                        {item.picked ? (
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white">
                            <CheckCircle2 size={12} />
                          </div>
                        ) : (
                          <div className="w-5 h-5 bg-gray-200 rounded-full" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                {f.status === 'pending' && (
                  <Button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-0 h-11 rounded-2xl font-bold shadow-lg shadow-blue-100"
                    onClick={() => handleUpdateStatus(f.id, 'picking')}
                  >
                    Start Picking
                  </Button>
                )}
                {f.status === 'picking' && (
                  <>
                    <Button 
                      variant="outline"
                      className="flex-1 h-11 rounded-2xl border-gray-200"
                      onClick={() => setScanningFor(f.id === scanningFor ? null : f.id)}
                    >
                      <QrCode size={18} className="mr-2" />
                      {scanningFor === f.id ? 'Cancel Scanning' : 'Scan to Pick'}
                    </Button>
                    <Button 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-0 h-11 rounded-2xl font-bold"
                      onClick={() => handleUpdateStatus(f.id, 'picked')}
                    >
                      Finish Picking
                    </Button>
                  </>
                )}
                {f.status === 'picked' && (
                  <Button 
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white border-0 h-11 rounded-2xl font-bold"
                    onClick={() => handleUpdateStatus(f.id, 'packing')}
                  >
                    Start Packing
                  </Button>
                )}
                {f.status === 'packing' && (
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white border-0 h-11 rounded-2xl font-bold"
                    onClick={() => handleUpdateStatus(f.id, 'packed')}
                  >
                    Mark as Packed
                  </Button>
                )}
                {f.status === 'packed' && (
                  <Button 
                    className="flex-1 bg-gray-900 hover:bg-black text-white border-0 h-11 rounded-2xl font-bold"
                    onClick={() => router.push(`/orders/${f.order_id}`)}
                  >
                    <Truck size={18} className="mr-2" />
                    Dispatch / Ship
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-11 h-11 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-500 border-0"
                  onClick={() => printPickList(f)}
                  title="Print Pick List"
                >
                  <Printer size={18} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-11 h-11 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-500 border-0"
                  onClick={() => printPackingSlip(f)}
                  title="Print Packing Slip"
                >
                  <FileText size={18} />
                </Button>
              </div>

              {scanningFor === f.id && (
                <form onSubmit={handleScanBarcode} className="mt-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="relative">
                    <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={18} />
                    <Input 
                      placeholder="Scan item barcode to verify..." 
                      className="pl-10 h-12 bg-blue-50 border-blue-100 rounded-2xl focus-visible:ring-blue-500 font-bold"
                      autoFocus
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 px-1">Tip: Use a USB/Bluetooth barcode scanner or type and hit Enter.</p>
                </form>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="lg:col-span-2 py-32 text-center bg-gray-50/50 rounded-[48px] border-2 border-dashed border-gray-100">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
              <Package size={40} />
            </div>
            <h3 className="text-xl font-black text-gray-900">Nothing to fulfil</h3>
            <p className="text-sm text-gray-400 mt-2">Check back later when orders are ready for processing.</p>
          </div>
        )}
      </div>
    </div>
  )
}
