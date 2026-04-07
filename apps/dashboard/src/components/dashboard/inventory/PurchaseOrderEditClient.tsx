'use client'

import React from 'react'
import { PurchaseOrderFormClient } from './PurchaseOrderFormClient'

export function PurchaseOrderEditClient({ 
  suppliers, 
  po 
}: { 
  suppliers: any[], 
  po: any 
}) {
  return (
    <PurchaseOrderFormClient 
      suppliers={suppliers} 
      initialData={po} 
    />
  )
}
