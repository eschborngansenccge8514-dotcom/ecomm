import { 
  Package, 
  CheckCircle2, 
  Truck, 
  Clock, 
  XCircle, 
  Box, 
  User, 
  CreditCard, 
  Wallet, 
  Navigation,
  MapPin,
} from 'lucide-react'

export type OrderStatus = 
  | 'pending'
  | 'paid'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'returned'
  | 'failed'

export const ORDER_STATUS_CONFIG: Record<string, {
  label: string
  color: string
  icon: any
  actionLabel?: string
  nextStatus?: string
}> = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: Clock,
  },
  paid: {
    label: 'New Order',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Package,
    actionLabel: 'Confirm Order',
    nextStatus: 'confirmed',
  },
  confirmed: {
    label: 'Confirmed',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    icon: CheckCircle2,
    actionLabel: 'Start Prep',
    nextStatus: 'preparing',
  },
  preparing: {
    label: 'Preparing',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: Box,
    actionLabel: 'Mark Ready',
    nextStatus: 'ready_for_pickup',
  },
  ready_for_pickup: {
    label: 'Ready',
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    icon: MapPin,
    actionLabel: 'Dispatched',
    nextStatus: 'out_for_delivery',
  },
  out_for_delivery: {
    label: 'Delivering',
    color: 'bg-sky-100 text-sky-700 border-sky-200',
    icon: Truck,
    actionLabel: 'Delivered',
    nextStatus: 'delivered',
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle,
  },
  refunded: {
    label: 'Refunded',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: Wallet,
  },
}

export const PAYMENT_METHOD_CONFIG: Record<string, { label: string, icon: any }> = {
  razorpay: { label: 'Card/Online', icon: CreditCard },
  billplz: { label: 'Online Banking', icon: CreditCard },
  cod: { label: 'Cash on Delivery', icon: Wallet },
  manual: { label: 'Manual Pay', icon: User },
}

export const DELIVERY_TYPE_CONFIG: Record<string, { label: string, icon: any }> = {
  delivery: { label: 'Delivery', icon: Truck },
  pickup: { label: 'Self Pickup', icon: MapPin },
}

export const DELIVERY_STATUS_CONFIG: Record<string, { label: string, color: string, stage: number }> = {
  // Lalamove & General
  finding_driver: { label: 'Finding Driver', color: 'text-amber-600 bg-amber-50 border-amber-100', stage: 0 },
  driver_assigned: { label: 'Driver Assigned', color: 'text-blue-600 bg-blue-50 border-blue-100', stage: 1 },
  picked_up: { label: 'Picked Up', color: 'text-indigo-600 bg-indigo-50 border-indigo-100', stage: 2 },
  in_transit: { label: 'In Transit', color: 'text-sky-600 bg-sky-50 border-sky-100', stage: 2 },
  delivered: { label: 'Delivered', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', stage: 3 },
  cancelled: { label: 'Cancelled', color: 'text-rose-600 bg-rose-50 border-rose-100', stage: -1 },
  failed: { label: 'Failed', color: 'text-rose-700 bg-rose-100 border-rose-200', stage: -1 },
  
  // EasyParcel Specific (Ship Status)
  'pending arrangement': { label: 'Pending', color: 'text-amber-600 bg-amber-50 border-amber-100', stage: 0 },
  'collected': { label: 'Collected', color: 'text-blue-600 bg-blue-50 border-blue-100', stage: 1 },
  'drop off': { label: 'Dropped Off', color: 'text-blue-600 bg-blue-50 border-blue-100', stage: 1 },
}

export function getDeliveryProgress(order: any) {
  const provider = order.delivery_provider
  const status = (order.delivery_status || '').toLowerCase()
  const shipStatus = (order.ship_status || '').toLowerCase()
  
  // Stages: 0-3 (Wait -> Assigned -> Transit -> Done)
  
  if (provider === 'lalamove') {
    if (['finding_driver', 'assigning_driver'].includes(status)) return 0
    if (['on_the_way', 'driver_assigned'].includes(status)) return 1
    if (['picked_up', 'in_transit'].includes(status)) return 2
    if (['delivered', 'completed'].includes(status)) return 3
    return -1
  }
  
  if (provider === 'easyparcel') {
    if (shipStatus.includes('pending') || shipStatus.includes('arrangement')) return 0
    if (shipStatus.includes('collected') || shipStatus.includes('drop off')) return 1
    if (shipStatus.includes('transit') || shipStatus.includes('delivering')) return 2
    if (shipStatus.includes('delivered') || shipStatus.includes('successfully')) return 3
    return -1
  }
  
  if (provider === 'self_pickup' || order.delivery_type === 'pickup') {
    if (order.status === 'preparing') return 0
    if (order.status === 'ready_for_pickup') return 1
    if (order.status === 'delivered') return 3
    return -1
  }
  
  return -1
}
