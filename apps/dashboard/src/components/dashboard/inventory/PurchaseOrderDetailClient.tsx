'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Send,
  XCircle,
  Trash2,
  Truck,
  Download,
  ChevronLeft,
  Mail,
  Calendar,
  Clock,
  ChevronRight,
  Package,
  DollarSign,
  CheckCircle2,
  CreditCard,
  Receipt,
  MessageSquare
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  sendPurchaseOrder,
  cancelPurchaseOrder,
  deletePurchaseOrder
} from '@/lib/purchase-order-actions'
import { GoodsReceivingModal } from './GoodsReceivingModal'
import { RecordPaymentModal } from './RecordPaymentModal'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  partially_received: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  received: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-purple-100 text-purple-700 border-purple-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200'
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-red-50 text-red-600 border-red-100',
  partially_paid: 'bg-yellow-50 text-yellow-600 border-yellow-100',
  paid: 'bg-green-50 text-green-600 border-green-100'
}

// ── Workflow stepper ─────────────────────────────────────────────────────────

type StepState = 'done' | 'active' | 'pending' | 'skipped'

interface WorkflowStep {
  id: string
  label: string
  sub?: string
  state: StepState
}

function buildSteps(po: any): WorkflowStep[] {
  const totalOrdered = po.purchase_order_items?.reduce((s: number, i: any) => s + i.quantity_ordered, 0) ?? 0
  const totalReceived = po.purchase_order_items?.reduce((s: number, i: any) => s + i.quantity_received, 0) ?? 0
  const receiptCount = po.goods_receipts?.length ?? 0
  const paymentCount = po.expenses?.length ?? 0

  const isCancelled = po.status === 'cancelled'
  const isSent = ['sent', 'partially_received', 'received', 'closed'].includes(po.status)
  const isReceiving = po.status === 'partially_received'
  const isReceived = ['received', 'closed'].includes(po.status)
  const isPaid = po.payment_status === 'paid'

  return [
    {
      id: 'created',
      label: 'Created',
      sub: po.created_at ? new Date(po.created_at).toLocaleDateString() : undefined,
      state: 'done',
    },
    {
      id: 'sent',
      label: 'Sent',
      sub: isSent && po.order_date ? new Date(po.order_date).toLocaleDateString() : undefined,
      state: isCancelled ? 'skipped' : isSent ? 'done' : po.status === 'draft' ? 'active' : 'pending',
    },
    {
      id: 'receiving',
      label: 'Receiving',
      sub: receiptCount > 0 ? `${totalReceived}/${totalOrdered} items · ${receiptCount} receipt${receiptCount !== 1 ? 's' : ''}` : undefined,
      state: isCancelled ? 'skipped' : isReceived ? 'done' : isReceiving ? 'active' : isSent ? 'active' : 'pending',
    },
    {
      id: 'received',
      label: 'Received',
      sub: isReceived ? `${totalOrdered} items` : undefined,
      state: isCancelled ? 'skipped' : isReceived ? 'done' : 'pending',
    },
    {
      id: 'paid',
      label: 'Paid',
      sub: isPaid
        ? `${paymentCount} payment${paymentCount !== 1 ? 's' : ''}`
        : po.amount_paid > 0
        ? `RM ${po.amount_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })} paid`
        : undefined,
      state: isCancelled ? 'skipped' : isPaid ? 'done' : po.payment_status === 'partially_paid' ? 'active' : 'pending',
    },
  ]
}

function WorkflowStepper({ po }: { po: any }) {
  const steps = buildSteps(po)

  if (po.status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 px-1 py-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100">
          <XCircle size={14} className="text-red-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-red-600">Cancelled</span>
        </div>
        <span className="text-xs text-gray-400">This purchase order has been cancelled.</span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-0 w-full overflow-x-auto pb-1">
      {steps.map((step, i) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center min-w-[80px] flex-1">
            {/* Dot + label row */}
            <div className="flex items-center w-full relative">
              {/* Left connector */}
              <div className={cn(
                "h-0.5 flex-1 transition-colors",
                i === 0 ? "opacity-0" :
                steps[i - 1].state === 'done' && (step.state === 'done' || step.state === 'active') ? "bg-blue-500" : "bg-gray-200"
              )} />
              {/* Circle */}
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all",
                step.state === 'done' ? "bg-blue-600 border-blue-600" :
                step.state === 'active' ? "bg-white border-blue-500 ring-4 ring-blue-50" :
                "bg-white border-gray-200"
              )}>
                {step.state === 'done' ? (
                  <CheckCircle2 size={14} className="text-white" />
                ) : step.state === 'active' ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                )}
              </div>
              {/* Right connector */}
              <div className={cn(
                "h-0.5 flex-1 transition-colors",
                i === steps.length - 1 ? "opacity-0" :
                step.state === 'done' && (steps[i + 1].state === 'done' || steps[i + 1].state === 'active') ? "bg-blue-500" : "bg-gray-200"
              )} />
            </div>
            {/* Label + sub */}
            <div className="mt-2 text-center px-1">
              <p className={cn(
                "text-[10px] font-extrabold uppercase tracking-widest leading-none",
                step.state === 'done' ? "text-blue-600" :
                step.state === 'active' ? "text-gray-900" :
                "text-gray-300"
              )}>
                {step.label}
              </p>
              {step.sub && (
                <p className="text-[9px] text-gray-400 font-medium mt-1 leading-tight">{step.sub}</p>
              )}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PurchaseOrderDetailClient({ po }: { po: any }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [receivingOpen, setReceivingOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

  const handleSend = (method: 'email' | 'whatsapp') => {
    startTransition(async () => {
      try {
        let base64Pdf: string | undefined
        
        if (method === 'whatsapp') {
          // Generate PDF to attach it to the WhatsApp message
          const doc = createPDFDoc()
          const dataUri = doc.output('datauristring')
          base64Pdf = dataUri.split(',')[1] // Extract base64 part
        }

        await sendPurchaseOrder(po.id, method, base64Pdf)
        toast.success(`PO sent via ${method === 'email' ? 'Email' : 'WhatsApp'}`)
        router.refresh()
      } catch (error: any) {
        toast.error(error.message || 'Failed to send PO')
      }
    })
  }

  const handleCancel = () => {
    if (!confirm('Are you sure you want to cancel this PO?')) return
    startTransition(async () => {
      try {
        await cancelPurchaseOrder(po.id)
        toast.success('PO cancelled')
        router.refresh()
      } catch (error) {
        toast.error('Failed to cancel PO')
      }
    })
  }

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this draft PO? This action cannot be undone.')) return
    startTransition(async () => {
      try {
        await deletePurchaseOrder(po.id)
        toast.success('PO deleted')
        router.push('/inventory/purchase-orders')
      } catch (error) {
        toast.error('Failed to delete PO')
      }
    })
  }

  const createPDFDoc = () => {
    const doc = new jsPDF()

    // ── Header Section ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.setTextColor(30, 58, 138) // dark blue text
    doc.text('PURCHASE ORDER', 14, 25)

    // Divider Line
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(14, 30, 196, 30)

    // ── Company Info (Top Right) & PO Details (Left) ──
    const merchant = po.merchants || {}
    const companyName = merchant.name || merchant.company_name || 'Our Company'

    // Left Side: PO Details
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text('PO NUMBER:', 14, 40)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40, 40, 40)
    doc.text(po.po_number || 'N/A', 45, 40)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 100, 100)
    doc.text('DATE:', 14, 46)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40, 40, 40)
    doc.text(new Date(po.order_date).toLocaleDateString(), 45, 46)

    if (po.expected_date) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 100, 100)
      doc.text('EXPECTED:', 14, 52)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40, 40, 40)
      doc.text(new Date(po.expected_date).toLocaleDateString(), 45, 52)
    }

    // Right Side: Merchant Info
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(40, 40, 40)
    doc.text(companyName, 196, 40, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    if (merchant.email) doc.text(merchant.email, 196, 46, { align: 'right' })
    if (merchant.phone) doc.text(merchant.phone, 196, 52, { align: 'right' })

    // ── Supplier Info ──
    doc.setFillColor(245, 247, 250)
    doc.rect(14, 60, 85, 30, 'F')
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(30, 58, 138)
    doc.text('VENDOR', 18, 67)
    
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text(po.suppliers?.name || 'N/A', 18, 74)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(po.suppliers?.email || '', 18, 79)
    doc.text(po.suppliers?.phone || '', 18, 84)

    // ── Items Table ──
    autoTable(doc, {
      startY: 100,
      head: [['Item Description', 'Qty', 'Unit Cost (RM)', 'Total (RM)']],
      body: po.purchase_order_items.map((item: any) => [
        item.products?.name,
        item.quantity_ordered,
        item.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })
      ]),
      headStyles: { 
        fillColor: [30, 58, 138], 
        textColor: [255, 255, 255],
        fontStyle: 'bold' 
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      styles: { fontSize: 9, cellPadding: 4 }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10

    // ── Notes Section ──
    if (po.notes) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(40, 40, 40)
      doc.text('Notes:', 14, finalY)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(po.notes, 14, finalY + 6, { maxWidth: 100 })
    }

    // ── Totals Section ──
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text('Subtotal:', 140, finalY)
    doc.setTextColor(40, 40, 40)
    doc.text(`RM ${po.subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || po.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 196, finalY, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(30, 58, 138)
    doc.text('Total Amount:', 140, finalY + 8)
    doc.text(`RM ${po.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 196, finalY + 8, { align: 'right' })

    if (po.payment_status === 'paid' || po.amount_paid > 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(34, 197, 94)
      doc.text('Amount Paid:', 140, finalY + 14)
      doc.text(`- RM ${po.amount_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 196, finalY + 14, { align: 'right' })

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(40, 40, 40)
      doc.text('Balance Due:', 140, finalY + 20)
      doc.text(`RM ${(po.total - po.amount_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 196, finalY + 20, { align: 'right' })
    }

    let statusY = finalY + (po.amount_paid > 0 ? 28 : 16)
    if (po.payment_status === 'paid') {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(34, 197, 94)
      doc.text('PAID IN FULL', 196, statusY, { align: 'right' })
    } else if (po.payment_status === 'partially_paid') {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(234, 179, 8)
      doc.text('PARTIALLY PAID', 196, statusY, { align: 'right' })
    }

    // ── Footer ──
    const pageHeight = doc.internal.pageSize.height
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(14, pageHeight - 15, 196, pageHeight - 15)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('This is a computer-generated document. No signature is required.', 105, pageHeight - 8, { align: 'center' })

    return doc
  }

  const generatePDF = () => {
    const doc = createPDFDoc()
    doc.save(`${po.po_number}.pdf`)
  }

  const payments: any[] = po.expenses ?? []
  const receipts: any[] = po.goods_receipts ?? []

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ChevronLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{po.po_number}</h1>
              <Badge variant="outline" className={cn(
                "rounded-full px-3 py-1 text-[10px] uppercase font-extrabold tracking-widest",
                STATUS_COLORS[po.status] || 'bg-gray-100'
              )}>
                {po.status.replace(/_/g, ' ')}
              </Badge>
              {po.payment_status && (
                <Badge variant="outline" className={cn(
                  "rounded-full px-3 py-1 text-[10px] uppercase font-extrabold tracking-widest",
                  PAYMENT_STATUS_COLORS[po.payment_status] || 'bg-gray-100'
                )}>
                  {po.payment_status.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1 uppercase font-bold tracking-tighter">Order for {po.suppliers?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {po.status === 'draft' && (
            <>
              <Button variant="ghost" onClick={handleDelete} className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl font-bold text-xs uppercase tracking-widest">
                <Trash2 size={16} className="mr-2" />
                Delete
              </Button>
              <Button variant="outline" onClick={() => router.push(`/inventory/purchase-orders/${po.id}/edit`)} className="rounded-xl font-bold text-xs uppercase tracking-widest border-gray-100 hover:bg-gray-50">
                <FileText size={16} className="mr-2" />
                Edit PO
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger 
                  disabled={isPending} 
                  className={cn(
                    "rounded-xl px-6 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 text-white font-bold text-sm inline-flex items-center justify-center transition-all",
                    isPending && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Send size={18} className="mr-2" />
                  {isPending ? 'Processing...' : 'Send PO'}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-xl border-gray-100">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-gray-400 px-3 py-2">Select Channel</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-gray-50" />
                    <DropdownMenuItem 
                      onClick={() => handleSend('email')} 
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                        po.suppliers?.preferred_contact_method === 'email' ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        po.suppliers?.preferred_contact_method === 'email' ? "bg-blue-100" : "bg-gray-50"
                      )}>
                        <Mail size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">Email</span>
                        <span className="text-[10px] opacity-70">{po.suppliers?.email || 'No email set'}</span>
                      </div>
                      {po.suppliers?.preferred_contact_method === 'email' && <CheckCircle2 size={14} className="ml-auto" />}
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                      onClick={() => handleSend('whatsapp')} 
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl cursor-pointer mt-1 transition-colors",
                        po.suppliers?.preferred_contact_method === 'whatsapp' ? "bg-green-50 text-green-700" : "hover:bg-gray-50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        po.suppliers?.preferred_contact_method === 'whatsapp' ? "bg-green-100" : "bg-gray-50"
                      )}>
                        <MessageSquare size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">WhatsApp</span>
                        <span className="text-[10px] opacity-70">{po.suppliers?.phone || 'No phone set'}</span>
                      </div>
                      {po.suppliers?.preferred_contact_method === 'whatsapp' && <CheckCircle2 size={14} className="ml-auto" />}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {(po.status === 'sent' || po.status === 'partially_received') && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setReceivingOpen(true)} className="rounded-xl px-4 border-green-100 text-green-700 hover:bg-green-50 font-bold text-xs uppercase tracking-widest">
                <Truck size={16} className="mr-2" />
                Receive
              </Button>

              {po.payment_status !== 'paid' && (
                <Button
                  onClick={() => setPaymentOpen(true)}
                  className="rounded-xl px-4 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold text-xs uppercase tracking-widest"
                >
                  <DollarSign size={16} className="mr-2" />
                  Pay
                </Button>
              )}
            </div>
          )}

          {po.status === 'received' && po.payment_status !== 'paid' && (
            <Button
              onClick={() => setPaymentOpen(true)}
              className="rounded-xl px-4 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold text-xs uppercase tracking-widest"
            >
              <DollarSign size={16} className="mr-2" />
              Pay
            </Button>
          )}

          <Button variant="outline" onClick={generatePDF} className="rounded-xl px-6 hover:bg-gray-50 border-gray-100 shadow-sm transition-all font-bold text-xs uppercase tracking-widest text-gray-500">
            <Download size={18} className="mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* ── Workflow Stepper ── */}
      <Card className="rounded-[24px] border-gray-50 shadow-sm px-8 py-5">
        <WorkflowStepper po={po} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ── Order Items ── */}
          <Card className="rounded-[24px] border-gray-50 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-50">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Order Items</CardTitle>
              <Package size={16} className="text-blue-500" />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-gray-50">
                    <TableHead className="pl-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Product</TableHead>
                    <TableHead className="text-center font-bold text-gray-400 uppercase text-[10px] tracking-widest">Ordered</TableHead>
                    <TableHead className="text-center font-bold text-gray-400 uppercase text-[10px] tracking-widest">Received</TableHead>
                    <TableHead className="text-right font-bold text-gray-400 uppercase text-[10px] tracking-widest">Unit Cost</TableHead>
                    <TableHead className="text-right pr-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.purchase_order_items.map((item: any) => (
                    <TableRow key={item.id} className="border-gray-50">
                      <TableCell className="font-medium text-gray-900 pl-6 uppercase italic tracking-tighter">{item.products?.name}</TableCell>
                      <TableCell className="text-center font-bold text-gray-900">{item.quantity_ordered}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                          item.quantity_received === 0 ? "bg-gray-50 text-gray-400 border border-transparent" :
                          item.quantity_received < item.quantity_ordered ? "bg-yellow-50 text-yellow-700 border border-yellow-100" :
                          "bg-green-50 text-green-700 border border-green-100"
                        )}>
                          {item.quantity_received}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-gray-600">{item.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right pr-6 font-bold text-gray-900">{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-6 border-t border-gray-50 flex flex-col items-end gap-2 bg-gray-50/30">
                <div className="flex items-center gap-24 text-sm font-medium text-gray-500">
                   <span>Subtotal</span>
                   <span className="font-bold text-gray-900">RM {po.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center gap-12 text-2xl mt-2 font-extrabold text-blue-600">
                   <span className="text-[10px] uppercase tracking-widest text-gray-400 font-extrabold">Grand Total</span>
                   <span>RM {po.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {(po.amount_paid > 0) && (
                <div className="p-6 pt-0 flex flex-col items-end gap-1 bg-gray-50/10">
                  <div className="flex items-center gap-12 text-sm text-green-600 font-bold">
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-extrabold">Amount Paid</span>
                    <span>- RM {po.amount_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center gap-12 text-md font-extrabold text-gray-900">
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-extrabold">Balance Due</span>
                    <span>RM {(po.total - po.amount_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {/* Payment progress bar */}
                  <div className="w-full max-w-xs mt-2">
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-green-500 h-full transition-all duration-500 rounded-full"
                        style={{ width: `${Math.min((po.amount_paid / po.total) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1 text-right">
                      {Math.round((po.amount_paid / po.total) * 100)}% paid
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Receipt History ── */}
          {receipts.length > 0 && (
            <Card className="rounded-[24px] border-gray-50 shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-50">
                <div>
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Receipt History</CardTitle>
                  <p className="text-[10px] text-gray-300 font-medium mt-0.5">{receipts.length} delivery event{receipts.length !== 1 ? 's' : ''}</p>
                </div>
                <Truck size={16} className="text-green-500" />
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-gray-50">
                      <TableHead className="pl-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Receipt ID</TableHead>
                      <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Date</TableHead>
                      <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Items</TableHead>
                      <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Notes</TableHead>
                      <TableHead className="text-right pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((receipt: any) => {
                      const itemCount = receipt.goods_receipt_items?.length ?? 0
                      const totalQty = receipt.goods_receipt_items?.reduce((s: number, i: any) => s + i.quantity_received, 0) ?? 0
                      return (
                        <TableRow
                          key={receipt.id}
                          className="cursor-pointer hover:bg-gray-50 group border-gray-50"
                          onClick={() => router.push(`/inventory/receipts/${receipt.id}`)}
                        >
                          <TableCell className="pl-6">
                            <div className="font-bold text-gray-900 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                              {receipt.id.slice(0, 8).toUpperCase()}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium text-gray-600">
                            {new Date(receipt.received_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg">
                              {totalQty} unit{totalQty !== 1 ? 's' : ''} · {itemCount} SKU{itemCount !== 1 ? 's' : ''}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-gray-400 italic max-w-[160px] truncate">
                            {receipt.notes || '—'}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <ChevronRight size={16} className="ml-auto text-gray-300 group-hover:text-blue-600 transition-colors" />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ── Payment History ── */}
          {payments.length > 0 && (
            <Card className="rounded-[24px] border-gray-50 shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-50">
                <div>
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Payment History</CardTitle>
                  <p className="text-[10px] text-gray-300 font-medium mt-0.5">{payments.length} transaction{payments.length !== 1 ? 's' : ''}</p>
                </div>
                <Receipt size={16} className="text-blue-400" />
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-gray-50">
                      <TableHead className="pl-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Date</TableHead>
                      <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Method</TableHead>
                      <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Notes</TableHead>
                      <TableHead className="text-right pr-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment: any) => (
                      <TableRow key={payment.id} className="border-gray-50">
                        <TableCell className="pl-6 text-sm font-medium text-gray-600">
                          {new Date(payment.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg w-fit">
                            <CreditCard size={10} />
                            {payment.payment_method}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-gray-400 italic max-w-[180px] truncate">
                          {payment.notes || '—'}
                        </TableCell>
                        <TableCell className="text-right pr-6 font-extrabold text-gray-900">
                          RM {payment.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* ── Supplier card ── */}
          <Card className="rounded-[24px] border-gray-50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-gray-50">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Supplier</CardTitle>
              <Truck size={16} className="text-gray-300" />
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <p className="font-bold text-gray-900 text-lg uppercase italic tracking-tighter leading-none">
                  {po.suppliers?.name}
                </p>
                <p className="text-xs text-gray-400 font-bold mt-2 uppercase tracking-widest leading-none border-l-2 border-blue-500 pl-2">
                  {po.suppliers?.code}
                </p>
              </div>
              <div className="space-y-3 pt-4">
                {po.suppliers?.email && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 font-medium">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                      <Mail size={14} className="text-blue-400" />
                    </div>
                    <span>{po.suppliers.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-600 border-t border-gray-50 pt-4 mt-2">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                    <Calendar size={14} className="text-orange-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-extrabold text-gray-300 leading-none tracking-widest">Order Date</p>
                    <p className="font-bold text-gray-700 mt-1.5">{new Date(po.order_date).toLocaleDateString()}</p>
                  </div>
                </div>
                {po.expected_date && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 border-t border-gray-50 pt-4 mt-2">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                      <Clock size={14} className="text-green-500" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-extrabold text-gray-300 leading-none tracking-widest">Expected Delivery</p>
                      <p className="font-bold text-gray-700 mt-1.5">{new Date(po.expected_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Quick stats ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
              <p className="text-[9px] font-extrabold text-blue-300 uppercase tracking-widest leading-none">Receipts</p>
              <p className="text-2xl font-black text-blue-700 mt-2 leading-none">{receipts.length}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-[9px] font-extrabold text-gray-300 uppercase tracking-widest leading-none">Payments</p>
              <p className="text-2xl font-black text-gray-700 mt-2 leading-none">{payments.length}</p>
            </div>
          </div>

          {/* ── Notes ── */}
          {po.notes && (
            <Card className="rounded-[24px] border-gray-50 shadow-sm bg-blue-50/20 border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-400">Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 leading-relaxed font-bold italic">
                "{po.notes}"
              </CardContent>
            </Card>
          )}

          {/* ── Cancel button for sent POs ── */}
          {(po.status === 'sent' || po.status === 'partially_received') && (
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={isPending}
              className="w-full text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl font-bold text-xs uppercase tracking-widest"
            >
              <XCircle size={14} className="mr-2" />
              Cancel PO
            </Button>
          )}
        </div>
      </div>

      {receivingOpen && (
        <GoodsReceivingModal
          po={po}
          onClose={() => {
            setReceivingOpen(false)
            router.refresh()
          }}
        />
      )}

      {paymentOpen && (
        <RecordPaymentModal
          po={po}
          onClose={() => {
            setPaymentOpen(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
