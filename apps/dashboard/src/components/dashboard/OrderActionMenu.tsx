'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  MoreHorizontal,
  Printer,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  AlertCircle,
  CreditCard,
  FileCheck,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { 
  updateOrderStatus, 
  printInvoice,
  bookLalamoveOrder,
  cancelLalamoveOrder,
  syncLalamoveStatus,
  syncEasyParcelStatus
} from '@/lib/order-actions'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface OrderActionMenuProps {
  order: any
  merchant: any
  merchantEinvoiceConfig: any
  onStatusUpdate?: (newStatus: string) => void
}

export function OrderActionMenu({ 
  order, 
  merchant, 
  merchantEinvoiceConfig,
  onStatusUpdate 
}: OrderActionMenuProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleUpdateStatus = async (newStatus: string) => {
    setLoading(true)
    const tid = toast.loading(`Updating order to ${newStatus}...`)
    try {
      await updateOrderStatus(order.id, newStatus)
      toast.success(`Order updated to ${newStatus}`, { id: tid })
      if (onStatusUpdate) onStatusUpdate(newStatus)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update order', { id: tid })
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    const eInv = order.einvoices?.[0] || null
    printInvoice(order, merchant, merchantEinvoiceConfig, eInv)
  }

  const handleBookLalamove = async () => {
    setLoading(true)
    const tid = toast.loading('Booking Lalamove...')
    try {
      const res = await bookLalamoveOrder(order.id)
      if (res.error) throw new Error(res.error)
      toast.success('Lalamove driver requested! 🏍️', { id: tid })
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to book Lalamove', { id: tid })
    } finally {
      setLoading(false)
    }
  }

  const handleSyncStatus = async () => {
    setLoading(true)
    const tid = toast.loading('Syncing delivery status...')
    try {
      if (order.delivery_provider === 'lalamove') {
        await syncLalamoveStatus(order.id)
      } else if (order.delivery_provider === 'easyparcel') {
        await syncEasyParcelStatus(order.id)
      }
      toast.success('Status synced successfully', { id: tid })
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Sync failed', { id: tid })
    } finally {
      setLoading(false)
    }
  }

  const status = order.status
  const deliveryStatus = (order.delivery_status || '').toLowerCase()
  const provider = order.delivery_provider
  const einvoice = order.einvoices?.[0] || null
  const isEInvoiceIssued = einvoice?.status === 'individual_issued' || !!einvoice?.lhdn_long_id

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          "h-8 w-8 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all outline-none"
        )}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> : <MoreHorizontal className="h-4 w-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-xl border-gray-100">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-1.5">Standard Actions</DropdownMenuLabel>
          
          {status === 'paid' && (
            <DropdownMenuItem onClick={() => handleUpdateStatus('confirmed')} className="rounded-xl focus:bg-blue-50 focus:text-blue-600 cursor-pointer group">
              <CheckCircle2 className="mr-2 h-4 w-4 text-blue-500" />
              <span className="font-semibold">Confirm Order</span>
            </DropdownMenuItem>
          )}
          {status === 'confirmed' && (
            <DropdownMenuItem onClick={() => handleUpdateStatus('preparing')} className="rounded-xl focus:bg-purple-50 focus:text-purple-600 cursor-pointer">
              <Package className="mr-2 h-4 w-4 text-purple-500" />
              <span className="font-semibold">Start Preparing</span>
            </DropdownMenuItem>
          )}

          {['confirmed', 'preparing', 'ready_for_pickup'].includes(status) && order.fulfilment_status !== 'fulfilled' && (
             <DropdownMenuItem onClick={() => router.push(`/orders/${order.id}?action=create-fulfilment`)} className="rounded-xl focus:bg-blue-50 focus:text-blue-600 cursor-pointer">
                <Package className="mr-2 h-4 w-4 text-blue-500" />
                <span className="font-semibold text-blue-600">Create Fulfilment 📦</span>
             </DropdownMenuItem>
          )}
          {(status === 'preparing' && provider !== 'lalamove') && (
            <DropdownMenuItem onClick={() => handleUpdateStatus('ready_for_pickup')} className="rounded-xl focus:bg-cyan-50 focus:text-cyan-600 cursor-pointer">
              <Truck className="mr-2 h-4 w-4 text-cyan-500" />
              <span className="font-semibold">Mark as Ready</span>
            </DropdownMenuItem>
          )}
          {(status === 'ready_for_pickup' || status === 'out_for_delivery' || deliveryStatus === 'picked_up' || deliveryStatus === 'in_transit') && (
            <DropdownMenuItem onClick={() => handleUpdateStatus('delivered')} className="rounded-xl focus:bg-green-50 focus:text-green-600 cursor-pointer">
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
              <span className="font-semibold">Mark Delivered</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator className="bg-gray-50 my-1" />

        {/* Provider Specific Actions */}
        {provider === 'lalamove' && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[10px] font-bold text-orange-400 uppercase tracking-widest px-2 py-1.5">Lalamove</DropdownMenuLabel>
            {deliveryStatus === 'not_requested' && status === 'confirmed' && (
              <DropdownMenuItem onClick={handleBookLalamove} className="rounded-xl focus:bg-orange-50 focus:text-orange-600 cursor-pointer">
                <Truck className="mr-2 h-4 w-4 text-orange-500" />
                <span className="font-semibold text-orange-600">Book Lalamove 🏍️</span>
              </DropdownMenuItem>
            )}
            {deliveryStatus !== 'not_requested' && (
              <>
                <DropdownMenuItem onClick={handleSyncStatus} className="rounded-xl focus:bg-orange-50 focus:text-orange-600 cursor-pointer">
                  <Loader2 className="mr-2 h-4 w-4 text-orange-500" />
                  <span className="font-medium">Sync Driver Status</span>
                </DropdownMenuItem>
                {order.delivery_tracking_url && (
                  <DropdownMenuItem onClick={() => window.open(order.delivery_tracking_url, '_blank')} className="rounded-xl focus:bg-orange-50 focus:text-orange-600 cursor-pointer">
                    <ExternalLink className="mr-2 h-4 w-4 text-orange-500" />
                    <span className="font-medium">Open Live Tracker</span>
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuGroup>
        )}

        {provider === 'easyparcel' && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[10px] font-bold text-pink-400 uppercase tracking-widest px-2 py-1.5">EasyParcel</DropdownMenuLabel>
            {!order.tracking_number && (
              <DropdownMenuItem onClick={() => router.push(`/orders/${order.id}?action=book-courier`)} className="rounded-xl focus:bg-pink-50 focus:text-pink-600 cursor-pointer">
                <Truck className="mr-2 h-4 w-4 text-pink-500" />
                <span className="font-semibold text-pink-600">Book Courier 📦</span>
              </DropdownMenuItem>
            )}
            {order.tracking_number && (
              <>
                <DropdownMenuItem onClick={handleSyncStatus} className="rounded-xl focus:bg-pink-50 focus:text-pink-600 cursor-pointer">
                  <Loader2 className="mr-2 h-4 w-4 text-pink-500" />
                  <span className="font-medium">Sync Courier Status</span>
                </DropdownMenuItem>
                {order.easyparcel_awb_url && (
                  <DropdownMenuItem onClick={() => window.open(order.easyparcel_awb_url, '_blank')} className="rounded-xl focus:bg-pink-50 focus:text-pink-600 cursor-pointer">
                    <Printer className="mr-2 h-4 w-4 text-pink-500" />
                    <span className="font-medium">Print Official AWB</span>
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuGroup>
        )}

        <DropdownMenuSeparator className="bg-gray-50 my-1" />

        {/* Documents */}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handlePrint} className="rounded-xl focus:bg-gray-50 cursor-pointer">
            <Printer className="mr-2 h-4 w-4 text-gray-500" />
            <span className="font-medium">Print Tax Invoice</span>
          </DropdownMenuItem>

          {isEInvoiceIssued ? (
            <DropdownMenuItem onClick={() => window.open(`https://myinvois.lhdn.gov.my/${einvoice?.submission_uid}`, '_blank')} className="rounded-xl focus:bg-green-50 focus:text-green-600 cursor-pointer">
              <FileCheck className="mr-2 h-4 w-4 text-green-500" />
              <span className="font-medium">View LHDN E-Invoice</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => router.push(`/orders/${order.id}?action=issue-einvoice`)} className="rounded-xl focus:bg-amber-50 focus:text-amber-600 cursor-pointer">
              <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />
              <span className="font-medium">Issue E-Invoice</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="bg-gray-50 my-1" />

        {/* Navigation */}
        <DropdownMenuItem onClick={() => router.push(`/orders/${order.id}`)} className="rounded-xl focus:bg-gray-50 cursor-pointer">
          <ExternalLink className="mr-2 h-4 w-4 text-gray-500" />
          <span className="font-medium">View Full Details</span>
        </DropdownMenuItem>

        {/* Danger Zone */}
        {['paid', 'confirmed', 'preparing'].includes(status) && (
          <>
            <DropdownMenuSeparator className="bg-gray-50 my-1" />
            <DropdownMenuItem 
              onClick={() => handleUpdateStatus('cancelled')} 
              className="rounded-xl focus:bg-red-50 focus:text-red-600 text-red-500 cursor-pointer"
            >
              <XCircle className="mr-2 h-4 w-4" />
              <span className="font-semibold">Cancel Order</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
