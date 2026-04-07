'use client'

import React, { useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  ShoppingCart,
  FileCheck,
  CreditCard,
  Truck,
  Plus,
  Zap,
  Clock,
  CheckCircle2
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SupplierListClient } from './SupplierListClient'
import { PurchaseOrderListClient } from './PurchaseOrderListClient'
import { PurchaseListClient } from './PurchaseListClient'

interface Props {
  suppliers: any[]
  purchaseOrders: any[]
  goodsReceipts: any[]
  payments: any[]
}

export function PurchasingPageClient({
  suppliers,
  purchaseOrders,
  goodsReceipts,
  payments
}: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'orders'

  const stats = useMemo(() => {
    const active = purchaseOrders.filter(po =>
      ['sent', 'partially_received'].includes(po.status)
    ).length
    const received = purchaseOrders.filter(po => po.status === 'received').length
    const draft = purchaseOrders.filter(po => po.status === 'draft').length
    const totalSpent = payments.reduce((acc, p) => acc + (p.total_amount || 0), 0)
    const unpaid = purchaseOrders.filter(po =>
      po.payment_status === 'unpaid' && po.status !== 'cancelled' && po.status !== 'draft'
    ).length

    return {
      total: purchaseOrders.length,
      active,
      received,
      draft,
      totalSpent,
      unpaid,
      suppliers: suppliers.filter(s => s.is_active).length
    }
  }, [purchaseOrders, payments, suppliers])

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.replace(`/inventory/purchasing?${params.toString()}`)
  }

  const tabs = [
    { id: 'orders', label: 'Purchase Orders', icon: ShoppingCart, count: purchaseOrders.length },
    { id: 'receipts', label: 'Goods Receipts', icon: FileCheck, count: goodsReceipts.length },
    { id: 'payments', label: 'Payments', icon: CreditCard, count: payments.length },
    { id: 'suppliers', label: 'Suppliers', icon: Truck, count: suppliers.length },
  ]

  const needsReceiving = purchaseOrders.filter(po => po.status === 'sent' || po.status === 'partially_received')
  const needsPayment = purchaseOrders.filter(po =>
    po.payment_status !== 'paid' && !['draft', 'cancelled'].includes(po.status)
  )

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Procurement Hub</h1>
          <p className="text-sm text-gray-400 font-medium mt-0.5">Supply chain · Suppliers · Payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/inventory/reorder"
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            <Zap size={15} className="text-blue-500" />
            Reorder
          </Link>
          {activeTab === 'suppliers' ? (
            <Link
              href="/inventory/suppliers/new"
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20"
            >
              <Plus size={15} />
              Add Supplier
            </Link>
          ) : (
            <Link
              href="/inventory/purchase-orders/new"
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20"
            >
              <Plus size={15} />
              New PO
            </Link>
          )}
        </div>
      </div>

      {/* ── Needs Attention ── */}
      {(needsReceiving.length > 0 || needsPayment.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {needsReceiving.length > 0 && (
            <button
              onClick={() => handleTabChange('orders')}
              className="flex items-start gap-4 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-left hover:bg-amber-100/60 transition-colors group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Truck size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-amber-700">Awaiting Delivery</p>
                <p className="text-lg font-black text-amber-900 leading-none mt-1">
                  {needsReceiving.length} PO{needsReceiving.length !== 1 ? 's' : ''}
                </p>
                <p className="text-[10px] text-amber-500 font-medium mt-1 truncate">
                  {needsReceiving.slice(0, 2).map((po: any) => po.po_number).join(', ')}
                  {needsReceiving.length > 2 ? ` +${needsReceiving.length - 2} more` : ''}
                </p>
              </div>
            </button>
          )}
          {needsPayment.length > 0 && (
            <button
              onClick={() => handleTabChange('payments')}
              className="flex items-start gap-4 p-4 rounded-2xl bg-red-50 border border-red-100 text-left hover:bg-red-100/60 transition-colors group"
            >
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CreditCard size={16} className="text-red-600" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-red-700">Outstanding Payments</p>
                <p className="text-lg font-black text-red-900 leading-none mt-1">
                  {needsPayment.length} PO{needsPayment.length !== 1 ? 's' : ''}
                </p>
                <p className="text-[10px] text-red-400 font-medium mt-1">
                  RM {needsPayment.reduce((s: number, po: any) => s + (po.total - (po.amount_paid || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} outstanding
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Active Orders"
          value={stats.active}
          icon={<Clock size={14} className="text-amber-500" />}
          highlight={stats.active > 0}
          highlightColor="amber"
        />
        <KpiCard
          label="Draft"
          value={stats.draft}
          icon={<ShoppingCart size={14} className="text-gray-400" />}
        />
        <KpiCard
          label="Received"
          value={stats.received}
          icon={<CheckCircle2 size={14} className="text-emerald-500" />}
        />
        <KpiCard
          label="Unpaid POs"
          value={stats.unpaid}
          icon={<CreditCard size={14} className="text-red-400" />}
          highlight={stats.unpaid > 0}
          highlightColor="red"
        />
        <KpiCard
          label="Active Suppliers"
          value={stats.suppliers}
          icon={<Truck size={14} className="text-blue-500" />}
        />
        <div className="bg-blue-600 rounded-2xl p-4 flex flex-col justify-between col-span-1">
          <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Total Spent</p>
          <p className="text-lg font-black text-white mt-1 leading-none">
            RM {stats.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* ── Tabs + Content ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center border-b border-gray-100 px-2 pt-2 gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all relative",
                  isActive
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                <span className={cn(
                  "text-[10px] font-black px-1.5 py-0.5 rounded-md",
                  isActive ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
                )}>
                  {tab.count}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="min-h-[480px]">
          {activeTab === 'orders' && (
            <div className="animate-in fade-in duration-200">
              <PurchaseOrderListClient initialOrders={purchaseOrders} hideHeader={true} />
            </div>
          )}
          {activeTab === 'receipts' && (
            <div className="animate-in fade-in duration-200">
              <PurchaseListClient initialPurchases={goodsReceipts} hideHeader={true} />
            </div>
          )}
          {activeTab === 'suppliers' && (
            <div className="animate-in fade-in duration-200">
              <SupplierListClient suppliers={suppliers} hideHeader={true} />
            </div>
          )}
          {activeTab === 'payments' && (
            <PaymentsTable payments={payments} router={router} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── KPI Card ── */
function KpiCard({
  label,
  value,
  icon,
  highlight = false,
  highlightColor = 'amber'
}: {
  label: string
  value: number
  icon: React.ReactNode
  highlight?: boolean
  highlightColor?: 'amber' | 'red'
}) {
  return (
    <div className={cn(
      "rounded-2xl p-4 flex flex-col justify-between border transition-all",
      highlight && highlightColor === 'amber' ? "bg-amber-50 border-amber-100" :
      highlight && highlightColor === 'red' ? "bg-red-50 border-red-100" :
      "bg-gray-50 border-gray-100"
    )}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        {icon}
      </div>
      <p className={cn(
        "text-2xl font-black mt-2 leading-none",
        highlight && highlightColor === 'amber' ? "text-amber-600" :
        highlight && highlightColor === 'red' ? "text-red-600" :
        "text-gray-900"
      )}>
        {value}
      </p>
    </div>
  )
}

/* ── Payments Table ── */
function PaymentsTable({ payments, router }: { payments: any[], router: any }) {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Date', 'PO Number', 'Supplier', 'Amount', 'Method'].map(h => (
                <th key={h} className={cn(
                  "px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400",
                  h === 'Amount' || h === 'Method' ? "text-right" : ""
                )}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-sm text-gray-400">
                  <CreditCard size={28} className="mx-auto mb-2 text-gray-200" />
                  No payments recorded yet.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer group"
                  onClick={() => router.push(`/inventory/purchase-orders/${p.purchase_order_id}`)}
                >
                  <td className="px-4 py-3.5 text-sm text-gray-600">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-black text-blue-600 uppercase tracking-tight group-hover:underline">
                    {p.purchase_orders?.po_number}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-gray-800 capitalize">
                    {p.purchase_orders?.suppliers?.name}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-black text-gray-900 text-right">
                    RM {p.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="px-2 py-1 bg-gray-100 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      {p.payment_method}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
