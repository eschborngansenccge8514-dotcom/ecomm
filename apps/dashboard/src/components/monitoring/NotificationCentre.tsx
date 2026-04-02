'use client'

import { Bell, Truck, Package, CreditCard, AlertCircle, X, CheckCircle2 } from 'lucide-react'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMonitoring, Notification } from '@/hooks/useMonitoring'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

export function NotificationCentre({ merchantId }: { merchantId: string }) {
  const { notifications, markAsRead } = useMonitoring(merchantId)
  const unreadCount = notifications.length

  const getIcon = (type: string) => {
    switch (type) {
      case 'lalamove': return <Truck className="w-4 h-4 text-orange-500" />
      case 'easyparcel': return <Package className="w-4 h-4 text-blue-500" />
      case 'payment': return <CreditCard className="w-4 h-4 text-green-500" />
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />
    }
  }

  const getLabel = (type: string) => {
    switch (type) {
      case 'lalamove': return 'Lalamove'
      case 'easyparcel': return 'EasyParcel'
      case 'payment': return 'Payment'
      default: return 'System'
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <div className="relative p-2 rounded-full hover:bg-gray-100 cursor-pointer">
          <Bell className="w-5 h-5 text-gray-500" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="p-4 border-b">
          <div className="flex items-center justify-between">
            <span className="font-bold">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">{unreadCount} unread</Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={cn(
                  "p-4 border-b last:border-0 hover:bg-gray-50 transition-colors cursor-pointer group",
                  !notification.is_read && "bg-blue-50/30"
                )}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex gap-3">
                  <div className="mt-1">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        {getLabel(notification.type)}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 leading-tight mb-1">
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {notification.body}
                    </p>
                    
                    {/* Action buttons based on data */}
                    {notification.data?.action === 'add_priority' && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" className="h-7 text-[10px] px-2">Add Priority Fee</Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2">Cancel & Retry</Button>
                      </div>
                    )}
                    {notification.data?.action === 'contact_courier' && (
                      <div className="mt-3">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 flex items-center gap-1">
                          Contact Courier
                        </Button>
                      </div>
                    )}
                    {notification.data?.action === 'contact_customer' && (
                      <div className="mt-3">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 flex items-center gap-1">
                          Contact Customer
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="p-3 text-center justify-center text-xs text-blue-600 font-medium cursor-pointer hover:underline">
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
