'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Plus, 
  Minus, 
  Package, 
  History, 
  AlertCircle,
  Truck,
  RotateCcw,
  Zap,
  Trash2,
  X,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { adjustInventory, type MovementType } from '@/lib/inventory-actions'
import toast from 'react-hot-toast'

interface Props {
  product: any
  onClose: () => void
  onSaved: (updatedProduct: any) => void
}

export function InventoryAdjustmentModal({ product, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('1')
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const [type, setType] = useState<MovementType>('restock')
  const [reason, setReason] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants?.length > 0 ? product.variants[0].id : null)

  const currentStock = selectedVariantId 
    ? product.variants.find((v: any) => v.id === selectedVariantId)?.stock_quantity ?? 0
    : product.stock_quantity ?? 0

  const handleSave = async () => {
    const delta = mode === 'add' ? Number(amount) : -Number(amount)
    if (isNaN(delta) || delta === 0) {
      toast.error('Invalid amount')
      return
    }

    setLoading(true)
    try {
      await adjustInventory({
        productId: product.id,
        variantId: selectedVariantId,
        quantityDelta: delta,
        type,
        reason
      })
      
      // Update local state for immediate feedback
      const updated = { ...product }
      if (selectedVariantId) {
        updated.variants = updated.variants.map((v: any) => 
          v.id === selectedVariantId 
            ? { ...v, stock_quantity: v.stock_quantity + delta } 
            : v
        )
      } else {
        updated.stock_quantity = (updated.stock_quantity ?? 0) + delta
      }
      
      onSaved(updated)
      toast.success('Inventory updated successfully')
      onClose()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update inventory')
    } finally {
      setLoading(false)
    }
  }

  const types: { value: MovementType; label: string; icon: any; color: string }[] = [
    { value: 'restock', label: 'Restock', icon: Truck, color: 'text-green-600 bg-green-50' },
    { value: 'return', label: 'Return', icon: RotateCcw, color: 'text-blue-600 bg-blue-50' },
    { value: 'adjustment', label: 'Adjustment', icon: Zap, color: 'text-amber-600 bg-amber-50' },
    { value: 'damaged', label: 'Damaged', icon: AlertCircle, color: 'text-red-600 bg-red-50' },
    { value: 'lost', label: 'Lost', icon: Trash2, color: 'text-gray-600 bg-gray-50' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl shadow-blue-500/10 overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative z-10">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Package size={20} className="text-blue-100" />
                    Adjust Inventory
                </h2>
                <p className="text-blue-100/80 text-xs mt-0.5 font-medium tracking-wide truncate max-w-[280px]">
                    {product.name}
                </p>
            </div>
            <button onClick={onClose} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-colors relative z-10 ring-offset-blue-600 focus:outline-none focus:ring-2 focus:ring-white">
                <X size={18} />
            </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
          {/* Variant Selection if multi-variant */}
          {product.variants?.length > 0 && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Select Variant</Label>
              <div className="grid grid-cols-2 gap-2">
                {product.variants.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    className={cn(
                      "px-3 py-2.5 rounded-2xl text-xs font-bold transition-all border text-left flex flex-col gap-0.5",
                      selectedVariantId === v.id 
                        ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20" 
                        : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"
                    )}
                  >
                    <span>{v.name}</span>
                    <span className={cn("text-[10px] opacity-80", selectedVariantId === v.id ? "text-blue-100" : "text-gray-400")}>
                        {v.stock_quantity ?? 0} in stock
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current Stock Display */}
          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">Current Stock Level</p>
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full animate-pulse", currentStock <= 5 ? "bg-amber-500" : "bg-green-500")} />
                <span className="text-2xl font-black text-gray-900">{currentStock}</span>
              </div>
            </div>
            <div className="text-right">
                <span className="text-xs font-bold text-gray-400">SKU</span>
                <p className="text-xs font-mono font-medium text-gray-600">{product.sku || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Action</Label>
              <div className="flex bg-gray-100 p-1.5 rounded-2xl">
                <button
                  onClick={() => { setMode('add'); setType('restock'); }}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5",
                    mode === 'add' ? "bg-white text-green-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Plus size={14} /> Add
                </button>
                <button
                  onClick={() => { setMode('remove'); setType('adjustment'); }}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5",
                    mode === 'remove' ? "bg-white text-red-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Minus size={14} /> Remove
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Quantity</Label>
              <Input
                type="number"
                min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="rounded-2xl bg-gray-50/50 border-gray-100 h-10 font-black text-lg focus:ring-blue-500 transition-all text-center"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Reason / Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {types.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  disabled={mode === 'add' && t.value === 'damaged'}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all text-[10px] font-bold",
                    type === t.value 
                      ? "bg-blue-600 text-white border-blue-600 shadow-md scale-[1.02]" 
                      : "bg-white text-gray-400 border-gray-100 hover:border-blue-200 hover:text-blue-600",
                    mode === 'add' && t.value === 'damaged' && "opacity-30 cursor-not-allowed grayscale"
                  )}
                >
                  <t.icon size={18} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Notes (Optional)</Label>
            <textarea
              className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[80px]"
              placeholder="e.g. Received new shipment from supplier..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
        </div>

        <div className="p-6 bg-gray-50/50 border-t border-gray-100">
          <Button
            onClick={handleSave}
            disabled={loading || !amount || Number(amount) <= 0}
            className={cn(
                "w-full rounded-2xl h-12 text-sm font-black uppercase tracking-wider transition-all",
                mode === 'add' ? "bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20" : "bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20"
            )}
          >
            {loading ? <Loader2 className="animate-spin" /> : mode === 'add' ? `Add ${amount} items` : `Remove ${amount} items`}
          </Button>
        </div>
      </div>
    </div>
  )
}
