'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LalamovePanel } from "./LalamovePanel"
import { EasyParcelPanel } from "./EasyParcelPanel"
import { PaymentPanel } from "./PaymentPanel"
import { Truck, Package, CreditCard } from "lucide-react"
import { useMonitoring } from "@/hooks/useMonitoring"

// Single hook call — data is shared across all three panels via props.
// This is the key fix: previously each panel called useMonitoring() independently,
// causing 3× the DB queries and 6× the Realtime subscriptions.
export function MonitoringDashboard({ merchantId }: { merchantId: string }) {
  const monitoring = useMonitoring(merchantId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Real-time Monitoring</h2>
      </div>
      
      <Tabs defaultValue="lalamove" className="w-full">
        <TabsList className="bg-gray-100/50 p-1 rounded-xl">
          <TabsTrigger value="lalamove" className="gap-2 rounded-lg data-active:bg-white data-active:shadow-sm px-6 py-2">
            <Truck className="w-4 h-4" /> Lalamove
          </TabsTrigger>
          <TabsTrigger value="easyparcel" className="gap-2 rounded-lg data-active:bg-white data-active:shadow-sm px-6 py-2">
            <Package className="w-4 h-4" /> EasyParcel
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2 rounded-lg data-active:bg-white data-active:shadow-sm px-6 py-2">
            <CreditCard className="w-4 h-4" /> Payments
          </TabsTrigger>
        </TabsList>
        
        <div className="mt-6">
          <TabsContent value="lalamove">
            <LalamovePanel data={monitoring} />
          </TabsContent>
          <TabsContent value="easyparcel">
            <EasyParcelPanel data={monitoring} />
          </TabsContent>
          <TabsContent value="payments">
            <PaymentPanel data={monitoring} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
