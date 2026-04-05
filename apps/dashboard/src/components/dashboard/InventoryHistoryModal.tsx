'use client'
import { useState, useEffect } from 'react'
import { 
  History, 
  X, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShoppingBag, 
  Truck, 
  RotateCcw, 
  Zap, 
  AlertCircle,
  Clock,
  Loader2,
  Calendar,
  Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInventoryHistory } from '@/lib/inventory-actions'
import { format } from 'date-fns'

interface Props {
  product: any
  onClose: () => void
}

export function InventoryHistoryModal({ product, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [movements, setMovements] = useState<any[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants?.length > 0 ? product.variants[0].id : null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await getInventoryHistory(product.id, selectedVariantId)
        setMovements(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [product.id, selectedVariantId])

  const getIcon = (type: string) => {
    switch (type) {
      case 'sale': return { icon: ShoppingBag, color: 'text-blue-600 bg-blue-50' }
      case 'restock': return { icon: Truck, color: 'text-green-600 bg-green-50' }
      case 'return': return { icon: RotateCcw, color: 'text-indigo-600 bg-indigo-50' }
      case 'adjustment': return { icon: Zap, color: 'text-amber-600 bg-amber-50' }
      case 'damaged': return { icon: AlertCircle, color: 'text-red-600 bg-red-50' }
      case 'lost': return { icon: X, color: 'text-gray-600 bg-gray-50' }
      default: return { icon: History, color: 'text-gray-600 bg-gray-50' }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl shadow-blue-500/10 overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                    <History size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Movement History</h2>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-0.5">{product.name}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2.5 hover:bg-gray-100 rounded-2xl transition-colors text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200">
                <X size={20} />
            </button>
        </div>

        {/* Filters / Variants */}
        {product.variants?.length > 0 && (
            <div className="px-8 py-4 bg-white border-b border-gray-50 overflow-x-auto no-scrollbar shrink-0 flex items-center gap-3">
                <div className="flex items-center gap-2 mr-2">
                    <Filter size={14} className="text-gray-400" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter:</span>
                </div>
                {product.variants.map((v: any) => (
                    <button
                        key={v.id}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap",
                            selectedVariantId === v.id 
                                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/10" 
                                : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                        )}
                    >
                        {v.name}
                    </button>
                ))}
            </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <p className="text-sm font-bold text-gray-400 animate-pulse">Loading audit logs...</p>
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Clock size={32} className="text-gray-200" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">No movements recorded</h3>
                <p className="text-gray-400 text-sm max-w-xs mt-2">Adjust your stock or make a sale to see transaction logs here.</p>
            </div>
          ) : (
            <div className="space-y-4">
                {movements.map((m, i) => {
                    const { icon: Icon, color } = getIcon(m.type)
                    const isPositive = m.quantity_delta > 0
                    
                    return (
                        <div key={m.id} className="group relative flex gap-4 animate-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${i * 30}ms` }}>
                            {/* Date Line */}
                            {i !== movements.length - 1 && (
                                <div className="absolute left-[23px] top-12 bottom-0 w-px bg-gray-100 group-last:hidden" />
                            )}
                            
                            {/* Icon */}
                            <div className={cn("z-10 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", color)}>
                                <Icon size={20} />
                            </div>

                            {/* Info Card */}
                            <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-4 hover:border-blue-100 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 mb-2">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-black text-gray-900 capitalize italic">{m.type}</h4>
                                        <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                            <Calendar size={10} />
                                            {format(new Date(m.created_at), 'MMM d, h:mm a')}
                                        </span>
                                    </div>
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black shadow-sm",
                                        isPositive ? "bg-green-500 text-white shadow-green-500/10" : "bg-red-500 text-white shadow-red-500/10"
                                    )}>
                                        {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                                        {isPositive ? '+' : ''}{m.quantity_delta}
                                    </div>
                                </div>
                                
                                {m.reason && <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">&ldquo;{m.reason}&rdquo;</p>}

                                <div className="flex items-center justify-between border-t border-gray-50 pt-2.5 mt-auto">
                                    <div className="flex items-center gap-2 text-[10px] font-extrabold text-gray-400 uppercase tracking-tighter">
                                        {m.pos_transactions?.receipt_number && (
                                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">
                                                Receipt: {m.pos_transactions.receipt_number}
                                            </span>
                                        )}
                                        {m.orders?.order_number && (
                                            <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">
                                                Order: {m.orders.order_number}
                                            </span>
                                        )}
                                        {!m.pos_transactions && !m.orders && <span>Manual Adjustment</span>}
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-300">ID: {m.id.slice(0, 8)}</span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
          )}
        </div>

        <div className="px-8 py-5 bg-gray-50/50 border-t border-gray-100 shrink-0">
            <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Showing last 50 inventory events
            </p>
        </div>
      </div>
    </div>
  )
}
