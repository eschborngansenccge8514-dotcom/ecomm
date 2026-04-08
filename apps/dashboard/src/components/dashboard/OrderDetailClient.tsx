'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { format } from 'date-fns'
import {
  ArrowLeft, Phone, Mail, User, MapPin, Package,
  Clock, CreditCard, Star, Truck, Printer,
  Loader2, ExternalLink, StickyNote, CheckCircle2,
  Circle, ChevronRight, AlertTriangle, RefreshCw,
  X, Plus, Search, FileCheck, ShieldAlert, Copy, Check, Info
} from 'lucide-react'

import { MY_STATE_OPTIONS, MY_STATES, shipStatusMeta, courierEmoji } from '@/lib/easyparcel'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── E-Invoice Validation ───────────────────────────────────────────────────

const TIN_REGEX = /^(IG|C|OG|TA|NR|EI|F|SG)[0-9]{10,12}$/
const NRIC_REGEX = /^[0-9]{12}$/
const BRN_REGEX = /^[a-zA-Z0-9]{1,20}$/
const PHONE_REGEX = /^\+?[0-9]{7,15}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/


// ─── Constants ───────────────────────────────────────────────────────────────

const MALAYSIAN_BANKS = [
  { label: 'Sandbox Test Bank (Verified)', code: 'DUMMYBANKVERIFIED' },
  { label: 'Maybank', code: 'MBBEMYKL' },
  { label: 'CIMB Bank', code: 'CIMBEMYKL' },
  { label: 'Public Bank', code: 'PBBEMYKL' },
  { label: 'RHB Bank', code: 'RHBEMYKL' },
  { label: 'Hong Leong Bank', code: 'HLBEMYKL' },
  { label: 'AmBank', code: 'AMBBEMYKL' },
  { label: 'UOB Bank', code: 'UOBBMYKL' },
  { label: 'Bank Islam', code: 'BIMBEMYKL' },
  { label: 'Bank Rakyat', code: 'BKRMMYKL' },
  { label: 'OCBC Bank', code: 'OCBCMYKL' },
  { label: 'Standard Chartered', code: 'SCBLMYKL' },
  { label: 'Alliance Bank', code: 'ABMBMYKL' },
  { label: 'Affin Bank', code: 'ABBEMYKL' },
  { label: 'HSBC Bank', code: 'HSBCMYKL' },
]

// ─── Status machine ──────────────────────────────────────────────────────────

const NEXT_ACTIONS: Record<string, { label: string; next: string; color: string }[]> = {
  paid: [
    { label: 'Accept Order', next: 'confirmed', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { label: 'Reject Order', next: 'cancelled', color: 'bg-red-500  hover:bg-red-600  text-white' },
  ],
  confirmed: [{ label: 'Start Preparing', next: 'preparing', color: 'bg-purple-600 hover:bg-purple-700 text-white' }],
  preparing: [{ label: 'Ready for Pickup', next: 'ready_for_pickup', color: 'bg-cyan-600   hover:bg-cyan-700   text-white' }],
  ready_for_pickup: [{ label: 'Mark Delivered', next: 'delivered', color: 'bg-green-600  hover:bg-green-700  text-white' }],
  out_for_delivery: [{ label: 'Mark Delivered', next: 'delivered', color: 'bg-green-600  hover:bg-green-700  text-white' }],
}

const STATUS_COLOR: Record<string, string> = {
  paid: 'bg-blue-100   text-blue-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  preparing: 'bg-purple-100 text-purple-700',
  ready_for_pickup: 'bg-cyan-100   text-cyan-700',
  out_for_delivery: 'bg-sky-100    text-sky-700',
  delivered: 'bg-green-100  text-green-700',
  cancelled: 'bg-red-100    text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

// ─── Order status timeline definition ────────────────────────────────────────

const getProviderSteps = (order: any) => {
  const provider = order.delivery_provider || (order.delivery_type === 'pickup' ? 'self_pickup' : null)
  
  if (provider === 'lalamove') {
    return [
      { key: 'paid', label: 'Order Placed', tsKey: 'created_at' },
      { key: 'preparing', label: 'Preparing', tsKey: 'preparing_at' },
      { key: 'finding_driver', label: 'Finding Driver', tsKey: 'ready_at' },
      { key: 'driver_assigned', label: 'Driver Assigned', tsKey: null },
      { key: 'picked_up', label: 'Driver Picked Up', tsKey: 'dispatched_at' },
      { key: 'delivered', label: 'Delivered', tsKey: 'delivered_at' },
    ]
  }

  if (provider === 'easyparcel') {
    return [
      { key: 'paid', label: 'Order Placed', tsKey: 'created_at' },
      { key: 'preparing', label: 'Preparing', tsKey: 'preparing_at' },
      { key: 'pending_arrangement', label: 'Booking Courier', tsKey: 'ready_at' },
      { key: 'collected', label: 'Courier Collected', tsKey: null },
      { key: 'delivering', label: 'In Transit', tsKey: 'dispatched_at' },
      { key: 'delivered', label: 'Delivered', tsKey: 'delivered_at' },
    ]
  }

  if (provider === 'self_pickup') {
     return [
      { key: 'paid', label: 'Order Placed', tsKey: 'created_at' },
      { key: 'preparing', label: 'Preparing', tsKey: 'preparing_at' },
      { key: 'ready_for_pickup', label: 'Ready for Pickup', tsKey: 'ready_at' },
      { key: 'delivered', label: 'Picked Up', tsKey: 'delivered_at' },
     ]
  }

  // Default Standard Delivery
  return [
    { key: 'paid', label: 'Order Placed', tsKey: 'created_at' },
    { key: 'confirmed', label: 'Accepted', tsKey: 'confirmed_at' },
    { key: 'preparing', label: 'Preparing', tsKey: 'preparing_at' },
    { key: 'out_for_delivery', label: 'Out for Delivery', tsKey: 'dispatched_at' },
    { key: 'delivered', label: 'Delivered', tsKey: 'delivered_at' },
  ]
}

function getActiveStepIndex(order: any, steps: any[]) {
   const primaryStatus = order.status
   const delStatus = (order.delivery_status || '').toLowerCase()
   const shipStatus = (order.ship_status || '').toLowerCase()
   const provider = order.delivery_provider || (order.delivery_type === 'pickup' ? 'self_pickup' : null)

   if (primaryStatus === 'cancelled' || primaryStatus === 'refunded' || primaryStatus === 'failed') return -1

   if (provider === 'lalamove') {
      if (primaryStatus === 'delivered') return steps.length - 1
      if (['picked_up', 'in_transit'].includes(delStatus)) return 4
      if (['on_the_way', 'driver_assigned'].includes(delStatus)) return 3
      if (['finding_driver', 'assigning_driver'].includes(delStatus)) return 2
      if (primaryStatus === 'preparing' || primaryStatus === 'confirmed') return 1
      if (primaryStatus === 'paid') return 0
      return 1 
   }

   if (provider === 'easyparcel') {
      if (primaryStatus === 'delivered' || shipStatus.includes('delivered') || shipStatus.includes('successfully')) return steps.length - 1
      if (shipStatus.includes('transit') || shipStatus.includes('delivering')) return 4
      if (shipStatus.includes('collected') || shipStatus.includes('drop off')) return 3
      if (shipStatus.includes('pending') || shipStatus.includes('arrangement') || order.tracking_number) return 2
      if (primaryStatus === 'preparing' || primaryStatus === 'confirmed') return 1
      if (primaryStatus === 'paid') return 0
      return 1
   }

   if (provider === 'self_pickup') {
      if (primaryStatus === 'delivered') return 3
      if (primaryStatus === 'ready_for_pickup') return 2
      if (primaryStatus === 'preparing' || primaryStatus === 'confirmed') return 1
      if (primaryStatus === 'paid') return 0
      return 0
   }

   // Standard
   if (primaryStatus === 'delivered') return 4
   if (primaryStatus === 'out_for_delivery') return 3
   if (primaryStatus === 'preparing') return 2
   if (primaryStatus === 'confirmed') return 1
   if (primaryStatus === 'paid') return 0

   return 0
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon, children, className }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('bg-white rounded-2xl border border-gray-100 p-5', className)}>
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-4">
          {icon && <span className="text-gray-400">{icon}</span>}
          <h3 className="font-bold text-gray-900">{title}</h3>
        </div>
      )}
      {children}
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span className={cn('text-sm font-medium text-gray-800 text-right', valueClass)}>{value}</span>
    </div>
  )
}

// ─── StatusTimeline ───────────────────────────────────────────────────────────

function StatusTimeline({ order }: { order: any }) {
  const cancelled = order.status === 'cancelled'

  if (cancelled) {
    return (
      <div className="flex items-center gap-2 bg-red-50 rounded-xl px-4 py-3">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div>
          <p className="text-sm font-bold text-red-700">Order Cancelled</p>
          {order.cancelled_at && (
            <p className="text-xs text-red-400">
              {format(new Date(order.cancelled_at), 'd MMM yyyy, h:mm a')}
            </p>
          )}
        </div>
      </div>
    )
  }

  const steps = getProviderSteps(order)
  const currentIdx = getActiveStepIndex(order, steps)

  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const isDone = i <= currentIdx
        const isActive = i === currentIdx
        const timestamp = step.tsKey ? order[step.tsKey] : null
        const isLast = i === steps.length - 1

        return (
          <div key={step.key} className="flex gap-3">
            {/* Dot + connector */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                isDone
                  ? isActive
                    ? 'bg-blue-500 ring-4 ring-blue-100'
                    : 'bg-green-500'
                  : 'bg-gray-100'
              )}>
                {isDone
                  ? <CheckCircle2 size={14} className="text-white" />
                  : <Circle size={14} className="text-gray-300" />}
              </div>
              {!isLast && (
                <div className={cn('w-0.5 flex-1 my-1 min-h-[20px]',
                  isDone && !isActive ? 'bg-green-400' : 'bg-gray-100')} />
              )}
            </div>
            {/* Label + timestamp */}
            <div className={cn('pb-4', isLast ? 'pb-0' : '')}>
              <p className={cn('text-sm font-semibold leading-7',
                isActive ? 'text-blue-600' : isDone ? 'text-gray-700' : 'text-gray-300')}>
                {step.label}
              </p>
              {timestamp && (
                <p className="text-xs text-gray-400 -mt-1">
                  {format(new Date(timestamp), 'd MMM yyyy, h:mm a')}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
import { 
  printInvoice, 
  updateOrderStatus 
} from '@/lib/order-actions'
import { invokeWorker } from '@/lib/worker'
import { 
  getFulfilments, 
  createFulfilment, 
  updateFulfilmentStatus 
} from '@/lib/fulfilment-actions'
import { printPickList, printPackingSlip } from '@/lib/fulfilment-print'


// ─── Modals ──────────────────────────────────────────────────────────────────

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 z-10">
        <h3 className="text-base font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            type="button"
            onClick={onConfirm}
            className={destructive
              ? 'bg-red-500 hover:bg-red-600 text-white border-0'
              : 'bg-blue-600 hover:bg-blue-700 text-white border-0'}
          >
            {confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function TipModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm: (amount: number) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('5')
  if (!open) return null
  const tip = parseFloat(value)
  const valid = !isNaN(tip) && tip >= 1 && tip <= 50

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 z-10">
        <h3 className="text-base font-bold text-gray-900 mb-1">Add Tip for Driver</h3>
        <p className="text-sm text-gray-500 mb-4">Enter an amount between RM 1 – RM 50</p>
        <input
          type="number"
          min="1"
          max="50"
          step="1"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            type="button"
            disabled={!valid}
            onClick={() => valid && onConfirm(tip)}
            className="bg-green-600 hover:bg-green-700 text-white border-0 disabled:opacity-50"
          >
            Add RM {valid ? tip.toFixed(0) : '—'} Tip
          </Button>
        </div>
      </div>
    </div>
  )
}

function CourierSelectionModal({
  open,
  couriers,
  loading,
  onSelect,
  onCancel,
  error,
}: {
  open: boolean
  couriers: any[]
  loading: boolean
  onSelect: (serviceId: string) => void
  onCancel: () => void
  error?: string | null
}) {
  const [searchTerm, setSearchTerm] = useState('')
  if (!open) return null

  const filtered = couriers.filter(c => 
    c.courierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.serviceName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col max-w-lg w-full max-h-[80vh] mx-4 z-10 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h3 className="text-base font-bold text-gray-900">Select Courier</h3>
            <p className="text-xs text-gray-400">Choose a service to book this parcel</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 bg-gray-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search courier or service..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
              <p className="text-sm">Fetching real-time rates...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
              <Package className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm px-10 font-medium text-gray-900">
                {error || "No available couriers found for this route and weight."}
              </p>
              {error && (
                <p className="text-xs mt-2 px-10 text-gray-400 italic">
                  Tip: Check your EasyParcel configuration and address settings.
                </p>
              )}
            </div>
          ) : (
            filtered.map((c: any) => (
              <button
                key={c.serviceId}
                onClick={() => onSelect(c.serviceId)}
                className="w-full text-left p-4 bg-white border border-gray-100 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center p-2 shrink-0 group-hover:bg-blue-50 transition-colors relative overflow-hidden">
                    <Image src={c.courierLogo} alt={c.courierName} fill className="object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{c.courierName}</span>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                        c.serviceDetail === 'pickup' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {c.serviceDetail}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1">{c.serviceName}</p>
                    <p className="text-[10px] text-gray-300 mt-1">{c.delivery}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-blue-600">RM {Number(c.priceRM || 0).toFixed(2)}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">inc. taxes</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
function CreateFulfilmentModal({
  open,
  order,
  fulfilments = [],
  onClose,
  onCreate
}: {
  open: boolean
  order: any
  fulfilments?: any[]
  onClose: () => void
  onCreate: (items: any[]) => void
}) {
  // calculate fulfilled amounts per item id
  const itemFulfilled = useMemo(() => {
    const counts: Record<string, number> = {}
    fulfilments.forEach(f => {
      if (f.status === 'cancelled') return
      f.fulfilment_items?.forEach((fi: any) => {
        counts[fi.order_item_id] = (counts[fi.order_item_id] || 0) + fi.quantity
      })
    })
    return counts
  }, [fulfilments])

  const [quantities, setQuantities] = useState<Record<string, number>>({})

  useEffect(() => {
    if (open) {
      setQuantities(
        Object.fromEntries(order.items?.map((i: any) => [
          i.id, 
          Math.max(0, i.quantity - (itemFulfilled[i.id] || 0))
        ]) || [])
      )
    }
  }, [open, order.items, itemFulfilled])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create New Fulfilment</DialogTitle>
          <p className="text-sm text-gray-500">Select items and quantities to fulfil in this batch.</p>
        </DialogHeader>
        
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
          {order.items?.map((item: any) => {
            const qty = quantities[item.id] || 0
            return (
              <div key={item.id} className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{item.product_name}</p>
                  <p className="text-xs text-gray-400">{item.variant_name || 'No variant'}</p>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-tight">Ordered: {item.quantity}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                    onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(0, q[item.id] - 1) }))}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-black text-blue-600">{qty}</span>
                  <button 
                    className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                    onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.min(item.quantity - (itemFulfilled[item.id] || 0), q[item.id] + 1) }))}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter className="bg-gray-50 -mx-6 -mb-6 p-6 mt-2">
          <Button variant="outline" className="rounded-xl border-gray-200" onClick={onClose}>Cancel</Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white border-0 rounded-xl px-6"
            onClick={() => {
              const selectedItems = order.items
                .filter((i: any) => quantities[i.id] > 0)
                .map((i: any) => ({
                  order_item_id: i.id,
                  quantity: quantities[i.id],
                  product_id: i.product_id,
                  variant_id: i.variant_id
                }))
              if (selectedItems.length === 0) {
                toast.error('Select at least one item')
                return
              }
              onCreate(selectedItems)
            }}
          >
            Create Batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Classification codes per LHDN MyInvois specification
const CLASSIFICATION_CODES = [
  { code: '022', label: 'Others', desc: 'General retail goods/services with no specific category' },
  { code: '003', label: 'Computers / Smartphones / Tablets', desc: 'Tech gadgets eligible for individual RM2,500 tax relief' },
  { code: '001', label: 'Breastfeeding equipment', desc: 'Eligible for individual tax relief' },
  { code: '013', label: 'Sports / Recreation / Gym', desc: 'Eligible for individual lifestyle tax relief' },
  { code: '044', label: 'Vouchers / Gift cards / Loyalty points', desc: 'Prepaid value products' },
  { code: '030', label: 'Repair and maintenance', desc: 'Service repairs' },
  { code: '027', label: 'Reimbursement', desc: 'Passing on a cost originally billed to your company' },
  { code: '018', label: 'Land and buildings', desc: 'Applicable for property-related transactions' },
  { code: '004', label: 'Consolidated e-Invoice', desc: 'ONLY for month-end General Public batch reporting' },
]

function IssueEInvoiceModal({
  open,
  onConfirm,
  onCancel,
  order,
  einvoice,
  merchantConfig,
  isSubmitting
}: {
  open: boolean
  onConfirm: (data: any) => void
  onCancel: () => void
  order: any
  einvoice?: any
  merchantConfig: any
  isSubmitting: boolean
}) {
  const addr = order.delivery_address || {}
  const reqDetails = order.einvoice_details || {}
  const invoiceDetails = einvoice?.einvoice_details || {}

  // Prioritize existing invoice data (if resubmitting), then requested data (if mobile app requested), then fallback to defaults.
  const initialTin = invoiceDetails.tin || reqDetails.tin || ''
  const initialName = invoiceDetails.name || reqDetails.name || order.buyer_name || addr.recipient_name || addr.name || ''
  // Only default to General Public if no TIN has been previously provided and no name is available
  const isB2C = initialTin === 'EI00000000010' || (!initialTin && !initialName)

  const [customer, setCustomer] = useState({
    name: initialName || 'General Public',
    tin: initialTin || 'EI00000000010',
    id_type: invoiceDetails.id_type || reqDetails.id_type || 'BRN',
    id_number: invoiceDetails.id_no || reqDetails.id_no || (isB2C ? 'NA' : ''),
    classification_code: isB2C ? '004' : '022',
    email: invoiceDetails.email || reqDetails.email || order.customer?.email || '',
    phone: invoiceDetails.phone || reqDetails.phone || addr.phone || order.customer?.phone || '',
    address_line1: invoiceDetails.address_line1 || reqDetails.address_line1 || addr.address_line1 || '',
    address_line2: invoiceDetails.address_line2 || reqDetails.address_line2 || addr.address_line2 || '',
    city: invoiceDetails.city || reqDetails.city || addr.city || '',
    state: invoiceDetails.state || reqDetails.state || addr.state || '',
    postcode: invoiceDetails.postcode || reqDetails.postcode || addr.postcode || ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const [merchantOverrides, setMerchantOverrides] = useState({
    msic_code: merchantConfig?.msic_code === '47910' ? '47912' : (merchantConfig?.msic_code || '47912'),
    description: merchantConfig?.description || 'Retail sale of any kind of product over the Internet'
  })

  const [showAdvanced, setShowAdvanced] = useState(false)

  if (!open) return null

  const isGeneralPublic = customer.tin === 'EI00000000010'

  const handleGeneralPublic = () => {
    setCustomer(prev => ({
      ...prev,
      name: 'General Public',
      tin: 'EI00000000010',
      id_type: 'BRN',
      id_number: 'NA',
      classification_code: '004',
      address_line1: 'NA',
      city: 'NA',
      state: '00',
      postcode: 'NA',
      phone: 'NA',
      email: ''
    }))
    setErrors({})
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!customer.name.trim()) newErrors.name = 'Name is required'
    
    // TIN validation
    const cleanTin = customer.tin.replace(/[\s-]/g, '').toUpperCase()
    if (!TIN_REGEX.test(cleanTin)) {
      newErrors.tin = 'Invalid TIN format (e.g. C1234567890)'
    }

    // ID Number validation only for non-general-public
    if (!isGeneralPublic) {
      const cleanId = customer.id_number.replace(/[\s-]/g, '')
      if (customer.id_type === 'NRIC' && !NRIC_REGEX.test(cleanId)) {
        newErrors.id_number = 'NRIC must be 12 digits with no dashes'
      } else if (customer.id_type === 'BRN' && !BRN_REGEX.test(cleanId)) {
        newErrors.id_number = 'Invalid BRN format'
      } else if (!cleanId) {
        newErrors.id_number = 'ID Number is required'
      }
    }

    // Email validation — for individual invoices, email is required (to send them the e-invoice)
    if (!isGeneralPublic && !customer.email) {
      newErrors.email = 'Email is required for individual e-invoice'
    } else if (customer.email && !EMAIL_REGEX.test(customer.email)) {
      newErrors.email = 'Invalid email address'
    }

    // Phone validation — skip for General Public (value will be 'NA')
    if (!isGeneralPublic && customer.phone) {
      const cleanPhone = customer.phone.replace(/[\s-]/g, '')
      if (!PHONE_REGEX.test(cleanPhone)) {
        newErrors.phone = 'Invalid phone number'
      }
    }

    // Address validation — General Public can use 'NA' placeholders; individual must have real address
    if (!isGeneralPublic) {
      if (!customer.address_line1.trim()) newErrors.address_line1 = 'Address line 1 is required'
      if (!customer.city.trim()) newErrors.city = 'City is required'
      if (!customer.state.trim()) newErrors.state = 'State is required'
      if (!customer.postcode.trim()) newErrors.postcode = 'Postcode is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validate()) {
      // Clean data before sending
      const cleanCustomer = {
        ...customer,
        tin: customer.tin.replace(/[\s-]/g, '').toUpperCase(),
        id_number: customer.id_number.replace(/[\s-]/g, '').toUpperCase(),
        phone: customer.phone.replace(/[\s-]/g, '')
      }
      onConfirm({ customer: cleanCustomer, merchantOverrides })
    } else {
      toast.error('Please fix the errors before submitting')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-3xl shadow-2xl flex flex-col max-w-2xl w-full max-h-[90vh] z-10 overflow-hidden border border-gray-100">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Issue E-Invoice</h3>
            <p className="text-sm text-gray-400">LHDN MyInvois · Individual or General Public</p>
          </div>
          <div className="flex items-center gap-3">
             <button 
               type="button"
               onClick={isGeneralPublic ? () => {
                 setCustomer(prev => ({
                   ...prev,
                   name: '',
                   tin: '',
                   id_type: 'NRIC',
                   id_number: '',
                   classification_code: '022',
                   address_line1: addr.address_line1 || '',
                   city: addr.city || '',
                   state: addr.state || '',
                   postcode: addr.postcode || '',
                   phone: addr.phone || '',
                   email: order.customer?.email || '',
                 }))
                 setErrors({})
               } : handleGeneralPublic}
               className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${isGeneralPublic ? 'bg-blue-500 text-white border-blue-500 shadow-md' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}
             >
               {isGeneralPublic ? '✓ General Public (B2C)' : 'Set General Public (B2C)'}
             </button>
             <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
               <X className="w-5 h-5 text-gray-400" />
             </button>
          </div>
        </div>

        {/* Context Banner */}
        {isGeneralPublic ? (
          <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3">
            <span className="text-lg shrink-0">🗂️</span>
            <div>
              <p className="text-xs font-bold text-blue-800">Consolidated / General Public Mode</p>
              <p className="text-xs text-blue-600 mt-0.5">For B2C transactions where the buyer does not need a personal e-invoice. Address and contact details are set to system defaults. This is typically used for month-end consolidated invoices.</p>
            </div>
          </div>
        ) : (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
            <span className="text-lg shrink-0">👤</span>
            <div>
              <p className="text-xs font-bold text-amber-800">Individual e-Invoice Mode</p>
              <p className="text-xs text-amber-700 mt-0.5">Required when the buyer requests a personal e-invoice for tax relief or business expense claims. Must collect their TIN, NRIC/BRN, email, and full address.</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Customer Details Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <User className="w-4 h-4" />
                <h4 className="text-sm font-bold uppercase tracking-wider">Identity</h4>
              </div>
              
              <div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="grid gap-2">
                  <Label htmlFor="custName" className="text-xs font-semibold text-gray-500 ml-1">Registration Name</Label>
                  <Input
                    id="custName"
                    value={customer.name}
                    onChange={e => setCustomer({ ...customer, name: e.target.value })}
                    placeholder="Full name or company name"
                    className={cn("bg-white border-gray-200 rounded-xl focus:ring-blue-500 h-10", errors.name && "border-red-500")}
                  />
                  {errors.name && <p className="text-[10px] text-red-500 ml-1 font-medium">{errors.name}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="custTin" className="text-xs font-semibold text-gray-500 ml-1">TIN Number</Label>
                  <Input
                    id="custTin"
                    value={customer.tin}
                    onChange={e => {
                      const val = e.target.value.toUpperCase()
                      setCustomer({ ...customer, tin: val, id_number: (val === 'EI00000000010' || val === 'EI00000000011') ? 'NA' : customer.id_number })
                    }}
                    placeholder="e.g. C1234567890"
                    className={cn("bg-white border-gray-200 rounded-xl focus:ring-blue-500 h-10", errors.tin && "border-red-500")}
                  />
                  {errors.tin ? <p className="text-[10px] text-red-500 ml-1 font-medium">{errors.tin}</p> : isGeneralPublic && <p className="text-[10px] text-blue-500 ml-1 font-medium">Using generic B2C TIN</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="custClass" className="text-xs font-semibold text-gray-500 ml-1">
                    Classification Code
                    {isGeneralPublic && <span className="ml-1 text-blue-500">(Consolidated — 004)</span>}
                  </Label>
                  {isGeneralPublic ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl h-10">
                      <span className="font-mono text-sm font-black text-blue-700">004</span>
                      <span className="text-xs text-blue-500">Consolidated e-Invoice</span>
                    </div>
                  ) : (
                    <Select
                      value={customer.classification_code}
                      onValueChange={v => setCustomer({...customer, classification_code: v || '022'})}
                    >
                      <SelectTrigger className="bg-white border-gray-200 rounded-xl focus:ring-blue-500 h-10">
                        <SelectValue placeholder="Select classification" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLASSIFICATION_CODES.filter(c => c.code !== '004').map(c => (
                          <SelectItem key={c.code} value={c.code}>
                            <span className="font-mono font-bold mr-1">{c.code}</span> — {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!isGeneralPublic && (() => {
                    const found = CLASSIFICATION_CODES.find(c => c.code === customer.classification_code)
                    return found ? (
                      <p className="text-[10px] text-gray-400 ml-1">{found.desc}</p>
                    ) : null
                  })()}
                </div>

                {!isGeneralPublic && (
                  <div className="grid gap-4 pt-1 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid gap-2">
                      <Label htmlFor="idType" className="text-xs font-semibold text-gray-500 ml-1">ID Type</Label>
                      <Select 
                        value={customer.id_type} 
                        onValueChange={v => setCustomer({...customer, id_type: v || 'BRN'})}
                      >
                        <SelectTrigger className="bg-white border-gray-200 rounded-xl focus:ring-blue-500 h-10">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NRIC">NRIC (Individual)</SelectItem>
                          <SelectItem value="BRN">BRN (Company)</SelectItem>
                          <SelectItem value="PASSPORT">Passport</SelectItem>
                          <SelectItem value="ARMY">Army ID</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="idNum" className="text-xs font-semibold text-gray-500 ml-1">ID Number</Label>
                      <Input
                        id="idNum"
                        value={customer.id_number}
                        onChange={e => setCustomer({ ...customer, id_number: e.target.value.toUpperCase() })}
                        placeholder="e.g. 900101015555"
                        className={cn("bg-white border-gray-200 rounded-xl focus:ring-blue-500 h-10", errors.id_number && "border-red-500")}
                      />
                      {errors.id_number && <p className="text-[10px] text-red-500 ml-1 font-medium">{errors.id_number}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className={`flex items-center gap-2 mb-2 ${isGeneralPublic ? 'text-gray-300' : 'text-blue-600'}`}>
                <MapPin className="w-4 h-4" />
                <h4 className="text-sm font-bold uppercase tracking-wider">Contact &amp; Address</h4>
                {isGeneralPublic && <span className="text-[10px] font-bold text-gray-300 ml-1">(Auto-managed)</span>}
              </div>

              <div className={`space-y-3 p-4 rounded-2xl border ${isGeneralPublic ? 'bg-gray-50/50 border-dashed border-gray-200 opacity-50 pointer-events-none select-none' : 'bg-gray-50 border-gray-100'}`}>
                 <div className="grid gap-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-gray-500 ml-1">Email</Label>
                  <Input
                    id="email"
                    value={customer.email}
                    onChange={e => setCustomer({ ...customer, email: e.target.value })}
                    placeholder="customer@example.com"
                    className={cn("bg-white border-gray-200 rounded-xl focus:ring-blue-500 h-10", errors.email && "border-red-500")}
                  />
                  {errors.email && <p className="text-[10px] text-red-500 ml-1 font-medium">{errors.email}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone" className="text-xs font-semibold text-gray-500 ml-1">Phone Number</Label>
                  <Input
                    id="phone"
                    value={customer.phone}
                    onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                    placeholder="e.g. 0123456789"
                    className={cn("bg-white border-gray-200 rounded-xl focus:ring-blue-500 h-10", errors.phone && "border-red-500")}
                  />
                  {errors.phone && <p className="text-[10px] text-red-500 ml-1 font-medium">{errors.phone}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="addr1" className="text-xs font-semibold text-gray-500 ml-1">Address Line 1</Label>
                  <Input
                    id="addr1"
                    value={customer.address_line1}
                    onChange={e => setCustomer({ ...customer, address_line1: e.target.value })}
                    placeholder="No. 1, Jalan Street"
                    className={cn("bg-white border-gray-200 rounded-xl focus:ring-blue-500 h-10", errors.address_line1 && "border-red-500")}
                  />
                  {errors.address_line1 && <p className="text-[10px] text-red-500 ml-1 font-medium">{errors.address_line1}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="addr2" className="text-xs font-semibold text-gray-500 ml-1">Address Line 2 (Optional)</Label>
                  <Input
                    id="addr2"
                    value={customer.address_line2}
                    onChange={e => setCustomer({ ...customer, address_line2: e.target.value })}
                    className="bg-white border-gray-200 rounded-xl h-10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="city" className="text-xs font-semibold text-gray-500 ml-1">City</Label>
                    <Input
                      id="city"
                      value={customer.city}
                      onChange={e => setCustomer({ ...customer, city: e.target.value })}
                      className={cn("bg-white border-gray-200 rounded-xl h-10", errors.city && "border-red-500")}
                    />
                    {errors.city && <p className="text-[10px] text-red-500 ml-1 font-medium">{errors.city}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="postcode" className="text-xs font-semibold text-gray-500 ml-1">Postcode</Label>
                    <Input
                      id="postcode"
                      value={customer.postcode}
                      onChange={e => setCustomer({ ...customer, postcode: e.target.value })}
                      className={cn("bg-white border-gray-200 rounded-xl h-10", errors.postcode && "border-red-500")}
                    />
                    {errors.postcode && <p className="text-[10px] text-red-500 ml-1 font-medium">{errors.postcode}</p>}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="state" className="text-xs font-semibold text-gray-500 ml-1">State</Label>
                  <Select 
                    value={customer.state} 
                    onValueChange={v => setCustomer({...customer, state: v})}
                  >
                    <SelectTrigger className={cn("bg-white border-gray-200 rounded-xl h-10", errors.state && "border-red-500")}>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.values(MY_STATES) as string[]).map(st => (
                        <SelectItem key={st} value={st}>{st}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.state && <p className="text-[10px] text-red-500 ml-1 font-medium">{errors.state}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Section Toggle */}
          <div>
            <button 
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-bold text-gray-400 hover:text-blue-500 flex items-center gap-1 transition-colors group"
            >
              Advanced Configuration {showAdvanced ? <Circle className="w-1.5 h-1.5 fill-blue-500" /> : <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />}
            </button>
            
            {showAdvanced && (
              <div className="mt-4 p-4 border border-blue-50 rounded-2xl bg-blue-50/30 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-blue-900/50 ml-1">Merchant MSIC Code</Label>
                  <Input
                    value={merchantOverrides.msic_code}
                    onChange={e => setMerchantOverrides({ ...merchantOverrides, msic_code: e.target.value })}
                    className="bg-white border-blue-100 rounded-xl h-9 text-xs"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-blue-900/50 ml-1">Merchant Business Type</Label>
                  <Input
                    value={merchantOverrides.description}
                    onChange={e => setMerchantOverrides({ ...merchantOverrides, description: e.target.value })}
                    className="bg-white border-blue-100 rounded-xl h-9 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-50 bg-gray-50/50">
          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel} 
              className="flex-1 rounded-xl h-11 border-gray-200 text-gray-600 hover:bg-gray-100"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 border-0 shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Issuing...
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 mr-2" />
                  Confirm & Issue E-Invoice
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OrderDetailClient({ order: initial, merchantId, customerOrderCount }: {
  order: any; merchantId: string; customerOrderCount: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [order, setOrder] = useState(initial)
  const [isUpdating, setIsUpdating] = useState(false)
  


  // Billplz Refund Modal State
  const [showBillplzRefund, setShowBillplzRefund] = useState(false)
  const [billplzRefundData, setBillplzRefundData] = useState({
    bankCode: 'DUMMYBANKVERIFIED',
    accountName: '',
    accountNumber: '',
  })

  const [confirm, setConfirm] = useState<{
    title: string; message: string; confirmLabel?: string; destructive?: boolean; action: () => void
  } | null>(null)
  const [showTip, setShowTip] = useState(false)
  const [showCouriers, setShowCouriers] = useState(false)
  const [couriers, setCouriers] = useState<any[]>([])
  const [loadingCouriers, setLoadingCouriers] = useState(false)
  const [courierError, setCourierError] = useState<string | null>(null)
  const [merchant, setMerchant] = useState<any>(null)
  const [eInvoice, setEInvoice] = useState<any>(null)
  const [isIssuingEInvoice, setIsIssuingEInvoice] = useState(false)
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(false)
  const [merchantEinvoiceConfig, setMerchantEinvoiceConfig] = useState<any>(null)
  const [isSyncingEasyParcel, setIsSyncingEasyParcel] = useState(false)
  const [easyparcelShipment, setEasyparcelShipment] = useState<any>(null)
  const [showManifest, setShowManifest] = useState(false)
  const [copiedAwb, setCopiedAwb] = useState(false)
  
  const [fulfilments, setFulfilments] = useState<any[]>([])
  const [loadingFulfilments, setLoadingFulfilments] = useState(false)
  const [showFulfilmentModal, setShowFulfilmentModal] = useState(false)


  const copyAwb = (awb: string) => {
    navigator.clipboard.writeText(awb)
    setCopiedAwb(true)
    setTimeout(() => setCopiedAwb(false), 2000)
    toast.success('AWB copied to clipboard')
  }
  const addr = order.delivery_address as any
  const actions = NEXT_ACTIONS[order.status] ?? []

  // ── Sync state with prop updates ──────────────────────────────────────────
  useEffect(() => {
    if (initial) setOrder(initial)
  }, [initial])

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`order-detail-${order.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        (payload) => {
          setOrder((prev: any) => ({ ...prev, ...payload.new }))
          toast.success('Order updated in real time')
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [order.id])

  // Fetch e-invoice status
  useEffect(() => {
    const fetchEInvoice = async () => {
      const supabase = createClient()
      try {
        const { data, error } = await supabase
          .from('einvoices')
          .select('*')
          .eq('order_id', order.id)
          .maybeSingle()
        
        if (error) {
          console.error('Error fetching e-invoice:', error)
          return
        }
        if (data) setEInvoice(data)
      } catch (err) {
        console.error('Failed to fetch e-invoice status:', err)
      }
    }
    fetchEInvoice()
    
    // Fetch merchant profile
    const fetchMerchant = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', merchantId)
        .single()
      if (data) setMerchant(data)
    }
    fetchMerchant()

    // Also fetch merchant e-invoice config for defaults
    const fetchConfig = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('merchant_einvoice_config')
        .select('*')
        .eq('merchant_id', merchantId)
        .single()
      if (data) setMerchantEinvoiceConfig(data)
    }
    fetchConfig()

    // Fetch fulfilments
    const fetchFulfilments = async () => {
      setLoadingFulfilments(true)
      try {
        const data = await getFulfilments(order.id)
        setFulfilments(data)
      } catch (err) {
        console.error('Failed to fetch fulfilments:', err)
      } finally {
        setLoadingFulfilments(false)
      }
    }
    fetchFulfilments()
  }, [order.id, merchantId])


  // Fetch EasyParcel shipment details for troubleshooting
  const fetchEasyParcelShipment = useCallback(async () => {
    if (order.delivery_provider !== 'easyparcel') return
    const supabase = createClient()
    const { data } = await supabase
      .from('easyparcel_shipments')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) setEasyparcelShipment(data)
  }, [order.id, order.delivery_provider])

  useEffect(() => {
    fetchEasyParcelShipment()
  }, [fetchEasyParcelShipment])

  const handleSyncEasyParcelStatus = async () => {
    if (!order.id) return
    setIsSyncingEasyParcel(true)
    const tid = toast.loading('Syncing EasyParcel status...')
    
    try {
      const { data, error } = await invokeWorker('easyparcel-sync-status', {
        body: { order_id: order.id }
      })

      if (error) throw error

      if (data?.results?.some((r: any) => r.order === order.easyparcel_order_no)) {
        toast.success('EasyParcel status synced successfully', { id: tid })
        await fetchEasyParcelShipment()
        // Also refresh order to pick up tracking number
        const supabase = createClient()
        const { data: updatedOrder } = await supabase.from('orders').select('*').eq('id', order.id).single()
        if (updatedOrder) setOrder(updatedOrder)
      } else {
        toast.success('No new updates found for this order.', { id: tid })
      }
    } catch (err: any) {
      console.error('EasyParcel Sync Error:', err)
      toast.error(err.message || 'Failed to sync EasyParcel status', { id: tid })
    } finally {
      setIsSyncingEasyParcel(false)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const askConfirm = useCallback((
    title: string,
    message: string,
    action: () => void,
    opts?: { confirmLabel?: string; destructive?: boolean }
  ) => {
    setConfirm({ title, message, action, ...opts })
  }, [])

  // ── Status update ────────────────────────────────────────────────────────
  const applyStatusUpdate = useCallback(async (nextStatus: string) => {
    setIsUpdating(true)
    const supabase = createClient()
    const now = new Date().toISOString()
    const updates: any = { status: nextStatus }

    if (nextStatus === 'confirmed') updates.confirmed_at = now
    if (nextStatus === 'preparing') updates.preparing_at = now
    if (nextStatus === 'ready_for_pickup') updates.ready_at = now
    if (nextStatus === 'delivered') updates.delivered_at = now
    if (nextStatus === 'cancelled') updates.cancelled_at = now

    const { error } = await supabase.from('orders').update(updates).eq('id', order.id)
    if (error) {
      toast.error(error.message)
      setIsUpdating(false)
      return
    }

    setOrder((prev: any) => ({ ...prev, ...updates }))
    toast.success(`Order marked as ${nextStatus.replace(/_/g, ' ')}`)

    // Auto-book Lalamove if confirmed
    if (nextStatus === 'confirmed' && order.delivery_provider === 'lalamove') {
      invokeWorker('lalamove-create-order', { body: { orderId: order.id } })
        .then(({ data, error: fErr }) => {
          if (fErr || data?.error) {
            toast.error('Lalamove auto-booking failed. Please book manually.')
          } else if (data?.success) {
            toast.success('Lalamove driver requested! 🏍️')
            router.refresh()
          }
        })
    }

    // Award loyalty points on delivery
    if (nextStatus === 'delivered') {
      invokeWorker('award-loyalty-points', { body: { orderId: order.id } })
        .then(({ data, error: fErr }) => {
          if (fErr) {
            console.error('Loyalty award error:', fErr)
            return
          }
          if (data?.success && data?.pointsAwarded > 0) {
            toast.success(`${data.pointsAwarded} loyalty pts awarded to customer 🌟`)
            setOrder((prev: any) => ({ ...prev, points_earned: data.pointsAwarded }))
          } else if (data?.skipped) {
            console.log('Loyalty award skipped:', data.reason)
          }
        })
    }

    // Auto-book EasyParcel if ready_for_pickup
    if (nextStatus === 'ready_for_pickup' && order.delivery_provider === 'easyparcel') {
      supabase.from('merchant_easyparcel_config')
        .select('auto_book_on_ready')
        .eq('merchant_id', order.merchant_id)
        .single()
        .then(({ data: epConfig }) => {
          if (epConfig?.auto_book_on_ready) {
            const tId = toast.loading('Auto-booking EasyParcel...')
            invokeWorker('easyparcel-create-order', { body: { orderId: order.id } })
              .then(({ data, error: fErr }) => {
                toast.dismiss(tId)
                if (fErr || data?.error) {
                  toast.error(`EasyParcel auto-booking failed: ${data?.error || fErr?.message}`, { duration: 5000 })
                } else if (data?.success) {
                  toast.success(`EasyParcel booked! AWB: ${data.awb} 📦`)
                  router.refresh()
                }
              })
          }
        })
    }

    setIsUpdating(false)
  }, [order.id, order.delivery_provider, router])

  const handleAwardPoints = async () => {
    if (isUpdating) return
    setIsUpdating(true)
    const tId = toast.loading('Awarding loyalty points...')

    try {
      const { data, error } = await invokeWorker('award-loyalty-points', { body: { orderId: order.id } })
      toast.dismiss(tId)

      if (error || data?.error) {
        toast.error(`Award failed: ${data?.error || error?.message}`)
      } else if (data?.success) {
        toast.success(`${data.pointsAwarded} points awarded! 🌟`)
        setOrder((prev: any) => ({ ...prev, points_earned: data.pointsAwarded }))
      } else if (data?.skipped) {
        toast(data.reason, { icon: 'ℹ️' })
      }
    } catch (err: any) {
      toast.dismiss(tId)
      toast.error(err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStatusUpdate = (nextStatus: string, label: string) => {
    if (nextStatus === 'cancelled') {
      askConfirm('Reject this order?', 'The customer will be notified. This cannot be undone.', () => applyStatusUpdate(nextStatus), { confirmLabel: 'Reject', destructive: true })
    } else {
      askConfirm(label, `Change order status to "${label}"?`, () => applyStatusUpdate(nextStatus), { confirmLabel: 'Confirm' })
    }
  }

  // ── Lalamove booking ─────────────────────────────────────────────────────
  const handleRefreshStatus = async () => {
    if (isUpdating) return
    setIsUpdating(true)
    const tId = toast.loading('Syncing latest status from Lalamove...')

    try {
      const { data, error } = await invokeWorker('lalamove-get-order-status', {
        body: { orderId: order.id }
      })

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Sync failed')
      }

      if (data.changed) {
        toast.success('Status updated!', { id: tId })
      } else {
        toast.success('Status is up to date', { id: tId })
      }
      
      // The Postgres change subscription will handle the UI update if there's a real change,
      // but we force a refresh here just in case.
      router.refresh()
    } catch (err: any) {
      toast.error(err.message, { id: tId })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRetry = async () => {
    askConfirm('Book Lalamove', 'Book this delivery with Lalamove?', async () => {
      setIsUpdating(true)
      try {
        const { data, error } = await invokeWorker('lalamove-test-connection', { body: { orderId: order.id } })
        if (error || data?.error) throw new Error(error?.message ?? data?.error)
        if (data?.priceChanged) {
          askConfirm(
            'Price Changed',
            `Price changed to RM ${data.newPrice?.toFixed(2)} (was RM ${data.oldPrice?.toFixed(2)}). Continue?`,
            async () => {
              setIsUpdating(true)
              try {
                const { data: r2, error: e2 } = await invokeWorker('lalamove-retry-order', { body: { orderId: order.id, confirmPriceChange: true } })
                if (e2 || r2?.error) throw new Error(e2?.message ?? r2?.error)
                toast.success('Booked successfully! 🏍️')
                router.refresh()
              } catch (e: any) { toast.error(e.message) }
              finally { setIsUpdating(false) }
            },
            { confirmLabel: 'Yes, Book' }
          )
        } else if (data?.success) {
          toast.success('Booked successfully! 🏍️')
          router.refresh()
        } else {
          throw new Error(data?.error || 'Failed to book')
        }
      } catch (e: any) { toast.error(e.message) }
      finally { setIsUpdating(false) }
    }, { confirmLabel: 'Book Now' })
  }

  const handleCancelLalamove = () => {
    askConfirm('Cancel Lalamove?', 'Cancel the Lalamove delivery booking?', async () => {
      setIsUpdating(true)
      try {
        const { data, error } = await invokeWorker('lalamove-cancel', { body: { orderId: order.id, reason: 'Cancelled by merchant' } })
        if (error || data?.error) throw new Error(error?.message ?? data?.error)
        toast.success('Cancelled successfully')
        router.refresh()
      } catch (e: any) { toast.error(e.message) }
      finally { setIsUpdating(false) }
    }, { confirmLabel: 'Cancel Booking', destructive: true })
  }

  const handleAddTip = () => setShowTip(true)

  const doAddTip = async (tip: number) => {
    setShowTip(false)
    setIsUpdating(true)
    try {
      const { data, error } = await invokeWorker('lalamove-add-priority-fee', { body: { orderId: order.id, tipAmount: tip } })
      if (error || data?.error) throw new Error(error?.message ?? data?.error)
      toast.success(`RM ${tip} tip added!`)
      router.refresh()
    } catch (e: any) { toast.error(e.message) }
    finally { setIsUpdating(false) }
  }

  // ── EasyParcel booking ───────────────────────────────────────────────────
  const handleBookEasyParcel = async () => {
    setShowCouriers(true)
    setLoadingCouriers(true)
    const supabase = createClient()
    
    try {
      // Fetch available couriers for this order
      const { data, error } = await invokeWorker('get-delivery-quotes', {
        body: {
          merchantId: order.merchant_id,
          deliveryAddress: order.delivery_address,
          totalWeightKg: order.total_weight_kg || 1.0,
          parcelValue: order.subtotal,
          mode: 'merchant' // Key change: get full list
        }
      })
      
      console.log("[OrderDetailClient] get-delivery-quotes response:", data)

      if (error || data?.error) throw new Error(data?.error || error?.message)
      const list = data.courier || []
      setCouriers(list)
      
      // Detailed error if empty
      if (list.length === 0) {
        const debugErr = data._debug?.easyparcel?.error
        const stats = data._debug?.easyparcel ? ` (Found ${data._debug.easyparcel.rawRates || 0} raw, ${data._debug.easyparcel.filteredRates || 0} filtered)` : ""
        setCourierError(debugErr ? `EasyParcel: ${debugErr}${stats}` : "No compatible couriers found for this route and weight.")
      } else {
        setCourierError(null)
      }
    } catch (e: any) {
      toast.error(`Failed to load couriers: ${e.message}`)
      setShowCouriers(false)
    } finally {
      setLoadingCouriers(false)
    }
  }

  const handleSelectCourier = async (serviceId: string) => {
    setShowCouriers(false)
    setIsUpdating(true)
    const tId = toast.loading('Booking courier with EasyParcel... 📦')
    
    const supabase = createClient()
    try {
      const { data, error } = await invokeWorker('easyparcel-create-order', {
        body: { 
          orderId: order.id,
          serviceId // Pass the merchant's choice
        },
      })
      
      toast.dismiss(tId)
      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Failed to book courier')
      } else {
        toast.success(`Parcel booked with ${data.courierName}! AWB: ${data.trackingNumber} 📦`)
        setOrder((prev: any) => ({
          ...prev,
          status: 'confirmed',
          tracking_number: data.trackingNumber,
          tracking_url: data.trackingUrl,
        }))
        router.refresh()
      }
    } catch (e: any) {
      toast.dismiss(tId)
      toast.error(e.message)
    } finally {
      setIsUpdating(false)
    }
  }

  // ── Razorpay Refund ──────────────────────────────────────────────────────
  const handleRefund = () => {
    askConfirm(
      'Refund Order?',
      `Are you sure you want to refund RM ${Number(order.total_amount).toFixed(2)} to the customer? This will call Razorpay and cannot be undone.`,
      async () => {
        setIsUpdating(true)
        const supabase = createClient()
        try {
          const { data, error } = await invokeWorker('razorpay-refund', {
            body: { orderId: order.id }
          })
          
          if (error || data?.error) {
            throw new Error(error?.message || data?.error || 'Refund failed')
          }
          
          toast.success('Order refunded successfully! 💸')
          setOrder((prev: any) => ({
            ...prev,
            status: 'refunded',
            payment_status: 'refunded',
            refund_id: data.refundId,
            refunded_at: new Date().toISOString(),
            is_refunded: true,
            refunded_amount: prev.total_amount
          }))
          router.refresh()
        } catch (e: any) {
          toast.error(e.message)
        } finally {
          setIsUpdating(false)
        }
      },
      { confirmLabel: 'Refund Now', destructive: true }
    )
  }

  const handleCreateFulfilment = async (items: any[]) => {
    setShowFulfilmentModal(false)
    setIsUpdating(true)
    const tId = toast.loading('Creating fulfilment batch...')
    try {
      await createFulfilment(order.id, items)
      toast.success('Batch created!', { id: tId })
      const data = await getFulfilments(order.id)
      setFulfilments(data)
    } catch (err: any) {
      toast.error(err.message, { id: tId })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleBillplzRefund = async () => {
    if (!billplzRefundData.accountName || !billplzRefundData.accountNumber) {
      toast.error('Please fill in all bank details')
      return
    }
    
    setIsUpdating(true)
    const supabase = createClient()
    try {
      const { data, error } = await invokeWorker('billplz-refund', {
        body: { 
          orderId: order.id,
          bankCode: billplzRefundData.bankCode,
          accountName: billplzRefundData.accountName,
          accountNumber: billplzRefundData.accountNumber
        }
      })
      
      if (error || data?.error) {
        let msg = error?.message || data?.error || 'Refund failed'
        if (msg.includes('Payment Order Limit')) {
          msg = "Insufficient Payment Order Limit. Please top up your Billplz Sandbox 'Payment Order Limit' in the dashboard."
        }
        throw new Error(msg)
      }
      
      toast.success('Refund Payment Order created! 💸')
      setOrder((prev: any) => ({
        ...prev,
        status: 'refunded',
        payment_status: 'refunded',
        refund_id: data.refundId,
        refunded_at: new Date().toISOString(),
        is_refunded: true,
        refunded_amount: prev.total_amount
      }))
      setShowBillplzRefund(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleIssueEInvoice = async (overrides?: any) => {
    if (isIssuingEInvoice) return
    
    if (!overrides && !showEInvoiceModal) {
      setShowEInvoiceModal(true)
      return
    }

    setIsIssuingEInvoice(true)
    const supabase = createClient()
    
    const tId = toast.loading('Submitting to LHDN MyInvois...')
    
    try {
      const { data, error } = await invokeWorker('einvoice/submit', {
        body: { 
          orderId: order.id, 
          merchant_id: merchantId,
          customer: overrides?.customer,
          merchant_overrides: overrides?.merchantOverrides
        }
      })

      if (error) {
        const msg = typeof error === 'string' ? error : (error.message || error.error || 'Failed to submit e-invoice')
        throw new Error(msg)
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Submission failed without specific error')
      }

      toast.dismiss(tId)
      setEInvoice(data.data)
      setShowEInvoiceModal(false)
      toast.success('E-Invoice issued successfully! 📄')
      
      router.refresh()
    } catch (err: any) {
      toast.dismiss(tId)
      console.error('E-Invoice Error:', err)
      toast.error(`E-Invoice Issue Failed: ${err.message}`, { duration: 5000 })
    } finally {
      setIsIssuingEInvoice(false)
    }
  }

  const isInstant = order.delivery_provider === 'lalamove'
  const isCourier = order.delivery_provider === 'easyparcel'
  const isSelfPickup = order.delivery_type === 'self_pickup'

  const canBookDelivery =
    (isInstant || isCourier) &&
    !order.lalamove_order_id &&
    !order.tracking_number &&
    ['confirmed', 'preparing', 'ready_for_pickup'].includes(order.status)

  // Quick actions via URL — run once on mount only
  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'create-fulfilment' && order.status !== 'cancelled' && order.status !== 'unpaid') {
      setShowFulfilmentModal(true)
    } else if (action === 'book-courier' && order.delivery_provider === 'easyparcel') {
      handleBookEasyParcel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        destructive={confirm?.destructive}
        onConfirm={() => { const action = confirm?.action; setConfirm(null); action?.() }}
        onCancel={() => setConfirm(null)}
      />
      <TipModal
        open={showTip}
        onConfirm={doAddTip}
        onCancel={() => setShowTip(false)}
      />
      <IssueEInvoiceModal
        open={showEInvoiceModal}
        onConfirm={handleIssueEInvoice}
        onCancel={() => setShowEInvoiceModal(false)}
        order={order}
        einvoice={eInvoice}
        merchantConfig={merchantEinvoiceConfig}
        isSubmitting={isIssuingEInvoice}
      />
      <CourierSelectionModal
        open={showCouriers}
        couriers={couriers}
        loading={loadingCouriers}
        error={courierError}
        onSelect={handleSelectCourier}
        onCancel={() => setShowCouriers(false)}
      />

      <div className="space-y-4 max-w-5xl">

        {/* ── Back + header bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-9 px-3">
              <ArrowLeft size={16} className="mr-1" /> Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{order.order_number}</h1>
                <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full capitalize',
                  STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600')}>
                  {order.status.replace(/_/g, ' ')}
                </span>
                {/* Realtime pulse indicator */}
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                {format(new Date(order.created_at), 'd MMM yyyy, h:mm a')}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => eInvoice ? printInvoice(order, merchant, merchantEinvoiceConfig, eInvoice) : setShowEInvoiceModal(true)} 
            className="h-9 px-3 bg-white text-gray-700 border-gray-200 shadow-sm hover:bg-gray-50 transition-all active:scale-95"
          >
            {eInvoice ? <Printer size={15} className="mr-1.5 text-blue-600" /> : <FileCheck size={15} className="mr-1.5 text-amber-500" />}
            {eInvoice ? 'Print Tax Invoice' : 'Issue & Print Invoice'}
          </Button>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ══ LEFT COLUMN (2/3 width) ════════════════════════════════════════ */}
          <div className="lg:col-span-2 space-y-4">

            {/* Customer notes banner */}
            {order.notes && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <StickyNote size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-700 mb-0.5">Customer Note</p>
                  <p className="text-sm text-amber-800">{order.notes}</p>
                </div>
              </div>
            )}

            {/* Items ordered */}
            <SectionCard title="Items Ordered" icon={<Package size={16} />}>
              <div className="space-y-3">
                {(order.items ?? []).map((item: any) => (
                  <div key={item.id} className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.product_name}</p>
                      {item.variant_name && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.variant_name}</p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-amber-600 mt-0.5 italic">"{item.notes}"</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        RM {Number(item.unit_price).toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 shrink-0">
                      RM {Number(item.line_total).toFixed(2)}
                    </p>
                  </div>
                ))}

                {/* Price breakdown */}
                <div className="border-t border-gray-50 pt-3 space-y-1.5">
                  <Row label="Subtotal" value={`RM ${Number(order.subtotal).toFixed(2)}`} />
                  <Row
                    label="Delivery Fee"
                    value={order.delivery_fee > 0
                      ? `RM ${Number(order.delivery_fee).toFixed(2)}`
                      : <span className="text-green-600 font-semibold">Free</span>}
                  />
                  {Number(order.discount_amount) > 0 && (
                    <Row
                      label="Promo Discount"
                      value={<span className="text-green-600">−RM {Number(order.discount_amount).toFixed(2)}</span>}
                    />
                  )}
                  {Number(order.points_discount) > 0 && (
                    <Row
                      label="🌟 Points Discount"
                      value={<span className="text-amber-600">−RM {Number(order.points_discount).toFixed(2)}</span>}
                    />
                  )}
                  <div className="flex justify-between items-center font-bold text-base border-t border-gray-100 pt-2 mt-1">
                    <span className="text-gray-900">Total</span>
                    <span className="text-blue-600 text-lg">RM {Number(order.total_amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Fulfilment */}
            {order.status !== 'cancelled' && order.status !== 'unpaid' && (
              <SectionCard 
                title="Fulfilment" 
                icon={<Package size={16} className="text-blue-500" />}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase">Fulfilment Status</p>
                      <div className="flex gap-2 items-center mt-1">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-bold",
                          order.fulfilment_status === 'fulfilled' ? "bg-green-100 text-green-700" :
                          order.fulfilment_status === 'partially_fulfilled' ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-500"
                        )}>
                          {(order.fulfilment_status || 'unfulfilled').replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    {order.fulfilment_status !== 'fulfilled' && (
                      <Button 
                        size="sm" 
                        onClick={() => setShowFulfilmentModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white border-0 h-9 px-4 rounded-xl shadow-md"
                      >
                        <Plus size={14} className="mr-1.5" />
                        New Fulfilment
                      </Button>
                    )}
                  </div>

                  {fulfilments.length > 0 ? (
                    <div className="space-y-3 pt-2">
                      {fulfilments.map((f) => (
                        <div key={f.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-gray-900">{f.fulfilment_number}</p>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                              f.status === 'shipped' ? "bg-green-100 text-green-700" :
                              f.status === 'delivered' ? "bg-green-100 text-green-700" :
                              "bg-blue-100 text-blue-700"
                            )}>
                              {f.status}
                            </span>
                          </div>
                          
                          <div className="space-y-1">
                            {f.fulfilment_items.map((item: any) => (
                              <div key={item.id} className="flex justify-between text-xs">
                                <span className="text-gray-500">{item.quantity}× {item.variant?.name || item.product?.name || 'Item'}</span>
                                {item.picked && <span className="text-green-600 font-bold">Picked</span>}
                              </div>
                            ))}
                          </div>

                          {f.status === 'pending' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="w-full text-xs h-8 rounded-lg"
                              onClick={async () => {
                                try {
                                  await updateFulfilmentStatus(f.id, 'picking')
                                  const data = await getFulfilments(order.id)
                                  setFulfilments(data)
                                  toast.success('Fulfilment moved to picking')
                                } catch (err: any) {
                                  toast.error(err.message)
                                }
                              }}
                            >
                              Start Picking
                            </Button>
                          )}
                          
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="flex-1 text-[10px] h-7 bg-white border border-gray-100"
                              onClick={() => printPickList(f)}
                            >
                              <Printer size={10} className="mr-1" /> Pick List
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="flex-1 text-[10px] h-7 bg-white border border-gray-100"
                              onClick={() => printPackingSlip(f)}
                            >
                              <Printer size={10} className="mr-1" /> Packing Slip
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <p className="text-sm text-gray-400 font-medium">No fulfilments created yet</p>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Customer info */}
            <SectionCard title="Customer" icon={<User size={16} />}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-base shrink-0">
                      {(order.customer?.full_name ?? addr?.name ?? 'G').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {order.customer?.full_name ?? addr?.name ?? 'Guest'}
                      </p>
                      {customerOrderCount > 1 && (
                        <p className="text-xs text-blue-600 font-medium">
                          {customerOrderCount} orders with you
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="space-y-1 pl-0.5">
                    {(order.customer?.email || addr?.email) && (
                      <a
                        href={`mailto:${order.customer?.email ?? addr?.email}`}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors w-fit"
                      >
                        <Mail size={13} className="text-gray-300" />
                        {order.customer?.email ?? addr?.email}
                      </a>
                    )}
                    {(order.customer?.phone || addr?.phone) && (
                      <a
                        href={`tel:${order.customer?.phone ?? addr?.phone}`}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors w-fit"
                      >
                        <Phone size={13} className="text-gray-300" />
                        {order.customer?.phone ?? addr?.phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* View customer history */}
                {order.customer_id && (
                  <Button variant="outline" size="sm"
                    onClick={() => router.push(`/customers?search=${order.customer_id}`)}
                    className="bg-white h-8 px-3"
                  >
                    History <ChevronRight size={14} className="ml-1" />
                  </Button>
                )}
              </div>

              {/* Delivery address */}
              {addr && !isSelfPickup && (
                <div className="mt-4 flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                  <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <p className="font-semibold text-gray-800">{addr.name}</p>
                    <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                    <p>{addr.city}, {addr.state} {addr.postcode}</p>
                  </div>
                </div>
              )}
              {isSelfPickup && (
                <div className="mt-4 flex items-center gap-2 bg-gray-50 rounded-xl p-3">
                  <Package size={14} className="text-gray-400" />
                  <p className="text-sm text-gray-600 font-medium">Self Pickup</p>
                </div>
              )}
            </SectionCard>

            {/* Payment */}
            <SectionCard title="Payment" icon={<CreditCard size={16} />}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Method</p>
                  <p className="text-sm font-semibold text-gray-800 capitalize">
                    {(order.payment_method ?? '—').replace(/_/g, ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full capitalize',
                    order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
                    {order.payment_status ?? '—'}
                  </span>
                </div>
                {Number(order.points_redeemed) > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">🌟 Points Redeemed</p>
                    <p className="text-sm font-semibold text-amber-600">
                      {order.points_redeemed.toLocaleString()} pts
                    </p>
                  </div>
                )}
                {Number(order.points_earned) > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">🌟 Points Earned</p>
                    <p className="text-sm font-semibold text-green-600">
                      +{order.points_earned.toLocaleString()} pts
                    </p>
                  </div>
                )}
                {order.status === 'delivered' && Number(order.points_earned) === 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">🌟 Loyalty Points</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAwardPoints}
                      disabled={isUpdating}
                      className="h-7 text-[10px] px-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      {isUpdating ? <Loader2 size={10} className="animate-spin mr-1" /> : 'Award Points'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Refund button for Razorpay */}
              {order.payment_status === 'paid' && order.payment_method === 'razorpay' && (
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefund}
                    disabled={isUpdating}
                    className="text-red-600 border-red-100 hover:bg-red-50 h-8 gap-2"
                  >
                    {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Refund Order
                  </Button>
                  <p className="text-[10px] text-gray-400 mt-2">
                    Refunding will return the full amount (RM {Number(order.total_amount).toFixed(2)}) via Razorpay.
                  </p>
                </div>
              )}

              {/* Refund button for Billplz */}
              {order.payment_status === 'paid' && order.payment_method === 'billplz' && (
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBillplzRefund(true)}
                    disabled={isUpdating}
                    className="text-red-600 border-red-100 hover:bg-red-50 h-8 gap-2"
                  >
                    {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Refund Order
                  </Button>
                  <p className="text-[10px] text-gray-400 mt-2">
                    Refunding will return the full amount (RM {Number(order.total_amount).toFixed(2)}) via Billplz.
                  </p>
                </div>
              )}
            </SectionCard>

            {/* EasyParcel Delivery Status */}
            {order.delivery_provider === 'easyparcel' && easyparcelShipment && (
              <SectionCard title="EasyParcel Delivery Status" icon={<Truck size={16} className="text-blue-600" />}>
                <div className="space-y-6">
                  {/* Status header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl shadow-sm border border-blue-50">
                        {courierEmoji(easyparcelShipment.courier_name || '')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{easyparcelShipment.courier_name || 'Standard Courier'}</span>
                          <span className={cn(
                            'text-[10px] font-black uppercase px-2 py-0.5 rounded-full ring-1 ring-inset',
                            shipStatusMeta(easyparcelShipment.ship_status || easyparcelShipment.order_status).bg.replace('bg-', 'ring-') + ' ' + 
                            shipStatusMeta(easyparcelShipment.ship_status || easyparcelShipment.order_status).bg + ' ' +
                            shipStatusMeta(easyparcelShipment.ship_status || easyparcelShipment.order_status).color
                          )}>
                            {shipStatusMeta(easyparcelShipment.ship_status || easyparcelShipment.order_status).label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs font-mono text-blue-600 font-bold">{easyparcelShipment.awb || 'No AWB assignment'}</p>
                          {easyparcelShipment.awb && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => copyAwb(easyparcelShipment.awb)} className="text-gray-300 hover:text-blue-600 transition-colors">
                                {copiedAwb ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                              </button>
                              {easyparcelShipment.awb_id_link && (
                                <a href={easyparcelShipment.awb_id_link} target="_blank" className="text-gray-300 hover:text-blue-600">
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={handleSyncEasyParcelStatus}
                      disabled={isSyncingEasyParcel}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-100 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSyncingEasyParcel ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Sync Tracking
                    </button>
                  </div>

                  {/* Tracking Timeline */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Tracking History</h4>
                    <div className="max-h-[300px] overflow-y-auto px-1">
                      {easyparcelShipment.tracking_data?.status_list ? (
                        <div className="space-y-6 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                          {Object.values(easyparcelShipment.tracking_data.status_list)
                            .filter((v: any) => v && typeof v === 'object' && v.event_date)
                            .sort((a: any, b: any) => {
                              const da = new Date(`${a.event_date} ${a.event_time || ''}`).getTime()
                              const db = new Date(`${b.event_date} ${b.event_time || ''}`).getTime()
                              return db - da
                            })
                            .map((event: any, i) => (
                              <div key={i} className="relative pl-8 group">
                                <div className={cn(
                                  "absolute left-0 top-1.5 w-5 h-5 rounded-full border-4 border-white shadow-sm ring-1 ring-gray-100 transition-transform group-hover:scale-110",
                                  i === 0 ? "bg-blue-600" : "bg-gray-300"
                                )} />
                                <div>
                                  <p className={cn("text-sm font-bold", i === 0 ? "text-gray-900" : "text-gray-500")}>
                                    {event.event_description || 'Update'}
                                  </p>
                                  <p className="text-xs text-gray-400 font-medium">
                                    <Clock className="w-3 h-3 inline mr-1" /> {event.event_date} {event.event_time} • {event.event_location || 'Standard Location'}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                          <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">No tracking history available yet.</p>
                          <p className="text-[10px] text-gray-300 mt-1 uppercase font-bold">Try syncing tracking manually</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Shipping Manifest (Collapsible) */}
                  <div className="pt-2 border-t border-gray-50">
                    <button 
                      onClick={() => setShowManifest(!showManifest)}
                      className="w-full flex items-center justify-between py-2 text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors group"
                    >
                      <span className="uppercase tracking-widest flex items-center gap-2">
                        <FileCheck size={14} /> Shipping Manifest
                      </span>
                      <ChevronRight size={14} className={cn('transition-transform duration-200', showManifest ? 'rotate-90' : '')} />
                    </button>
                    
                    {showManifest && (
                      <div className="space-y-6 pt-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-50 rounded-xl space-y-2 border border-gray-100">
                            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Sender (Pickup)</h5>
                            <Row label="Name" value={easyparcelShipment.pick_name || '—'} />
                            <Row label="Contact" value={easyparcelShipment.pick_contact || '—'} />
                            <Row label="Address" value={easyparcelShipment.pick_addr1 || '—'} />
                            <Row label="Postcode" value={`${easyparcelShipment.pick_postcode || ''} ${easyparcelShipment.pick_city || ''}`} />
                            <Row label="State" value={easyparcelShipment.pick_state || '—'} />
                          </div>
                          <div className="p-4 bg-gray-50 rounded-xl space-y-2 border border-gray-100">
                            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Receiver (Send)</h5>
                            <Row label="Name" value={easyparcelShipment.send_name || '—'} />
                            <Row label="Contact" value={easyparcelShipment.send_contact || '—'} />
                            <Row label="Address" value={easyparcelShipment.send_addr1 || '—'} />
                            <Row label="Postcode" value={`${easyparcelShipment.send_postcode || ''} ${easyparcelShipment.send_city || ''}`} />
                            <Row label="State" value={easyparcelShipment.send_state || '—'} />
                          </div>
                        </div>
                        <div className="p-4 bg-blue-50/20 rounded-xl space-y-2 border border-blue-50/50">
                          <Row label="System Order #" value={easyparcelShipment.ep_order_number} valueClass="font-mono text-xs text-blue-600" />
                          <Row label="Internal Status" value={easyparcelShipment.order_status} valueClass="font-bold text-gray-700" />
                          <Row label="Last Database Log" value={easyparcelShipment.updated_at ? format(new Date(easyparcelShipment.updated_at), 'd MMM, h:mm a') : '—'} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>
            )}
          </div>

          {/* ══ RIGHT COLUMN (1/3 width) ═══════════════════════════════════════ */}
          <div className="space-y-4">

            {/* Status + actions */}
            <SectionCard title="Status & Actions" icon={<Clock size={16} />}>
              <StatusTimeline order={order} />

              {/* Action buttons */}
              {actions.length > 0 && (
                <div className="mt-5 space-y-2">
                  {actions.map(a => (
                    <button key={a.next}
                      onClick={() => handleStatusUpdate(a.next, a.label)}
                      disabled={isUpdating}
                      className={cn(
                        'w-full py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 border-0',
                        a.color,
                        isUpdating && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      {isUpdating && <Loader2 size={14} className="animate-spin" />}
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* E-Invoicing */}
            <SectionCard title="E-Invoicing" icon={<FileCheck size={16} />}>
              <div className="space-y-4">
                {eInvoice ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">Status</p>
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded-full capitalize',
                        eInvoice.status === 'validated' ? 'bg-green-100 text-green-700' : 
                        eInvoice.status === 'submitted' ? 'bg-blue-100 text-blue-700' : 
                        eInvoice.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                      )}>
                        {eInvoice.status}
                      </span>
                    </div>

                    {eInvoice.status === 'rejected' && eInvoice.error_message && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-1.5">
                        <div className="flex items-center gap-2 text-red-700">
                          <ShieldAlert size={14} />
                          <p className="text-xs font-bold uppercase tracking-wider">LHDN Rejection</p>
                        </div>
                        <p className="text-[10px] text-red-600 font-medium leading-relaxed">
                          {eInvoice.error_message}
                        </p>
                        <Button 
                          size="sm" 
                          onClick={() => setShowEInvoiceModal(true)}
                          className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white h-8 text-[10px] font-black border-0"
                        >
                           Edit & Resubmit
                        </Button>
                      </div>
                    )}

                    {eInvoice.lhdn_uuid && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400 font-medium">LHDN UUID</p>
                        <p className="text-[10px] font-mono text-gray-600 truncate bg-gray-50 p-2 rounded-lg border border-gray-100" title={eInvoice.lhdn_uuid}>
                          {eInvoice.lhdn_uuid}
                        </p>
                      </div>
                    )}
                    {eInvoice.qr_code_url && (
                      <a href={eInvoice.qr_code_url} target="_blank" rel="noreferrer"
                        className="w-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100 transition-all">
                        <ExternalLink size={14} /> View on LHDN Portal
                      </a>
                    )}
                    {eInvoice.status === 'validated' && (
                       <button 
                        onClick={() => printInvoice(order, merchant, merchantEinvoiceConfig, eInvoice)}
                        className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
                      >
                         <Printer size={16} className="text-blue-600" />
                         Print Tax Invoice
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Issue an official LHDN e-invoice for this order once it is confirmed and paid.
                    </p>
                    <button 
                      onClick={() => handleIssueEInvoice()}
                      disabled={isIssuingEInvoice || order.status === 'cancelled' || (order.payment_status !== 'paid' && !eInvoice)}
                      className={cn(
                        "w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm border-0",
                        (order.payment_status === 'paid' && order.status !== 'cancelled') || eInvoice
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100" 
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      )}
                    >
                      {isIssuingEInvoice ? <Loader2 size={16} className="animate-spin" /> : <FileCheck size={16} />}
                      {isIssuingEInvoice ? 'Submitting to LHDN...' : 'Issue & Print E-Invoice'}
                    </button>
                    {order.payment_status !== 'paid' && (
                      <p className="text-[10px] text-amber-600 text-center font-medium">
                        Order must be PAID to issue an e-invoice.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>


            {/* Delivery */}
            <SectionCard title="Delivery" icon={<Truck size={16} />}>
              <div className="space-y-3">
                <Row
                  label="Type"
                  value={
                    <span className="capitalize">
                      {isSelfPickup ? '🏃 Self Pickup'
                        : isInstant ? '🏍️ Instant (Lalamove)'
                          : isCourier ? '📦 Courier (EasyParcel)'
                            : order.delivery_type?.replace(/_/g, ' ') ?? '—'}
                    </span>
                  }
                />
                {Number(order.delivery_fee) > 0 && (
                  <Row label="Fee" value={`RM ${Number(order.delivery_fee).toFixed(2)}`} />
                )}
                {order.estimated_delivery && (
                  <Row label="Estimated" value={format(new Date(order.estimated_delivery), 'd MMM, h:mm a')} />
                )}

                {/* Exception banner */}
                {order.exception_flag && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100 text-red-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold capitalize">{order.exception_flag.replace(/_/g, ' ')}</p>
                      <p className="opacity-80">
                        {order.exception_flag === 'driver_not_found'
                          ? "We couldn't find a driver. Try adding a tip or retrying."
                          : 'Delivery issue detected.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Lalamove order ID */}
                {order.lalamove_order_id && (
                  <Row label="Lalamove ID"
                    value={<span className="font-mono text-[10px]">{order.lalamove_order_id}</span>} />
                )}

                {/* Driver information */}
                {order.driver_name && (
                  <div className="bg-blue-50 rounded-2xl p-4 space-y-3 border border-blue-100/50 shadow-sm shadow-blue-50">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-blue-700 flex items-center gap-1">
                        <span>🏍️</span> Driver Assigned
                      </p>
                      {order.last_driver_update_at && (
                        <p className="text-[10px] text-blue-400 font-medium">
                          Updated {format(new Date(order.last_driver_update_at), 'h:mm a')}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {order.driver_photo_url && (
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-white shadow-sm shrink-0">
                          <Image 
                            src={order.driver_photo_url} 
                            alt={order.driver_name} 
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-blue-900 truncate">{order.driver_name}</p>
                        <a href={`tel:${order.driver_phone}`}
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-900 w-fit mt-0.5">
                          <Phone size={12} strokeWidth={2.5} />
                          {order.driver_phone}
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {order.driver_plate && (
                        <p className="text-[10px] text-blue-600 bg-white border border-blue-100 px-2.5 py-1 rounded-lg w-fit font-mono font-bold tracking-wider">
                          {order.driver_plate}
                        </p>
                      )}
                      {(order.last_driver_lat && order.last_driver_lng) && (
                        <div className="flex items-center gap-1 text-[9px] text-blue-400 font-mono bg-blue-100/30 px-2 py-1 rounded-lg">
                          <MapPin size={10} />
                          {order.last_driver_lat.toString().slice(0, 7)}, {order.last_driver_lng.toString().slice(0, 7)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Delivery Metadata (Lalamove Details) */}
                {order.delivery_metadata?.lalamove && (
                  <div className="bg-gray-50/80 rounded-2xl p-4 space-y-3 border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Delivery statistics</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {order.delivery_metadata.lalamove.distance && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-gray-400 font-medium">Est. Distance</p>
                          <p className="text-sm font-bold text-gray-800">
                            {order.delivery_metadata.lalamove.distance.value} {order.delivery_metadata.lalamove.distance.unit}
                          </p>
                        </div>
                      )}
                      {order.delivery_metadata.lalamove.priceBreakdown?.total && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-gray-400 font-medium">Lalamove Cost</p>
                          <p className="text-sm font-bold text-blue-600">
                            RM {parseFloat(order.delivery_metadata.lalamove.priceBreakdown.total).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Surcharges breakdown */}
                    {order.delivery_metadata.lalamove.priceBreakdown && (
                      <div className="pt-2 border-t border-gray-100 space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-400">Base Fare</span>
                          <span className="font-medium text-gray-600">RM {parseFloat(order.delivery_metadata.lalamove.priceBreakdown.base || '0').toFixed(2)}</span>
                        </div>
                        {parseFloat(order.delivery_metadata.lalamove.priceBreakdown.surcharge || '0') > 0 && (
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-gray-400">Surcharges</span>
                            <span className="font-medium text-orange-600">RM {parseFloat(order.delivery_metadata.lalamove.priceBreakdown.surcharge).toFixed(2)}</span>
                          </div>
                        )}
                        {parseFloat(order.delivery_metadata.lalamove.priceBreakdown.priorityFee || '0') > 0 && (
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-gray-400">Added Tip</span>
                            <span className="font-medium text-green-600">RM {parseFloat(order.delivery_metadata.lalamove.priceBreakdown.priorityFee).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Parcel tracking (EasyParcel or Lalamove) */}
                {(order.tracking_number || order.delivery_tracking_url) && (
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 border border-gray-100">
                    <p className="text-xs font-bold text-gray-600">📦 tracking & status</p>
                    {order.tracking_number && (
                      <p className="font-mono text-xs text-gray-700 font-bold">{order.tracking_number}</p>
                    )}
                    {(order.tracking_url || order.delivery_tracking_url) && (
                      <a href={order.tracking_url || order.delivery_tracking_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline w-fit">
                        <ExternalLink size={11} /> Track order
                      </a>
                    )}
                  </div>
                )}

                {/* Book delivery inline — only when applicable */}
                {canBookDelivery && (
                  <div className="pt-1 space-y-2">
                    {isInstant && (
                      <button onClick={handleRetry} disabled={isUpdating}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-60 border-0">
                        {isUpdating ? <Loader2 size={14} className="animate-spin" /> : '🏍️'}
                        {order.lalamove_order_id ? 'Retry Lalamove' : 'Book Lalamove Driver'}
                      </button>
                    )}
                    {isCourier && (
                      <button onClick={handleBookEasyParcel} disabled={isUpdating}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-60 border-0">
                        {isUpdating ? <Loader2 size={14} className="animate-spin" /> : '📦'}
                        Book Courier
                      </button>
                    )}
                  </div>
                )}

                {/* Delivery actions (Tip/Cancel) */}
                {order.lalamove_order_id && order.delivery_status !== 'delivered' && (
                  <div className="space-y-2 pt-1">
                    <button 
                      onClick={handleRefreshStatus}
                      disabled={isUpdating}
                      className="w-full bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl py-2 flex items-center justify-center gap-2 border border-gray-200 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      {isUpdating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      Refresh Status
                    </button>
                    
                    <div className="flex gap-2">
                       <Button type="button" size="sm" variant="outline" onClick={handleAddTip} disabled={isUpdating}
                        className="flex-1 h-9 gap-1.5 border-green-200 bg-green-50 text-green-700 hover:bg-green-100">
                        <Plus size={14} /> Tip
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={handleCancelLalamove} disabled={isUpdating}
                        className="flex-1 h-9 gap-1.5 text-red-600 border-red-100 hover:bg-red-50">
                        <X size={14} /> Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Loyalty summary */}
            {(Number(order.points_earned) > 0 || Number(order.points_redeemed) > 0) && (
              <SectionCard title="Loyalty Points" icon={<Star size={16} />}>
                <div className="space-y-2">
                  {Number(order.points_redeemed) > 0 && (
                    <div className="flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2">
                      <span className="text-xs text-amber-700 font-medium">Redeemed</span>
                      <span className="text-sm font-bold text-amber-700">
                        −{order.points_redeemed.toLocaleString()} pts
                      </span>
                    </div>
                  )}
                  {Number(order.points_earned) > 0 && (
                    <div className="flex items-center justify-between bg-green-50 rounded-xl px-3 py-2">
                      <span className="text-xs text-green-700 font-medium">Earned</span>
                      <span className="text-sm font-bold text-green-700">
                        +{order.points_earned.toLocaleString()} pts
                      </span>
                    </div>
                  )}
                  {Number(order.points_earned) === 0 && order.status !== 'delivered' && (
                    <p className="text-xs text-gray-400">Points will be awarded when order is delivered.</p>
                  )}
                </div>
              </SectionCard>
            )}

          </div>
        </div>
      </div>

      <Dialog open={showBillplzRefund} onOpenChange={setShowBillplzRefund}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refund via Billplz Payment Order</DialogTitle>
            <p className="text-sm text-gray-500 mt-2">
              Billplz refunds require a direct bank transfer (Payment Order). Please provide the customer's bank details.
            </p>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Select 
                value={billplzRefundData.bankCode} 
                onValueChange={(v: string | null) => v && setBillplzRefundData(p => ({ ...p, bankCode: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  {MALAYSIAN_BANKS.map(b => (
                    <SelectItem key={b.code} value={b.code}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Account Holder Name</Label>
              <Input 
                placeholder="e.g. John Doe"
                value={billplzRefundData.accountName}
                onChange={(e) => setBillplzRefundData(p => ({ ...p, accountName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input 
                placeholder="e.g. 1234567890"
                value={billplzRefundData.accountNumber}
                onChange={(e) => setBillplzRefundData(p => ({ ...p, accountNumber: e.target.value }))}
              />
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2.5 items-start">
              <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                Ensure your Billplz Payment Order limit is funded before submitting. 
                Refund amount: <strong>RM {Number(order.total_amount).toFixed(2)}</strong>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBillplzRefund(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={handleBillplzRefund} disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700">
              {isUpdating && <Loader2 size={14} className="animate-spin mr-2" />}
              Submit Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateFulfilmentModal
        open={showFulfilmentModal}
        order={order}
        fulfilments={fulfilments}
        onClose={() => setShowFulfilmentModal(false)}
        onCreate={handleCreateFulfilment}
      />
    </>
  )
}
