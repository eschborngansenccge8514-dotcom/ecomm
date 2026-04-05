import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

/**
 * Generates and prints a Tax Invoice for an order
 */
export function printInvoice(order: any, merchant: any, config: any, eInv: any) {
  const addr = order.delivery_address as any
  const items = (order.items ?? []) as any[]
  
  // Buyer e-invoice details
  const eDetails = order.einvoice_details ?? {}
  const buyerName = eDetails.customer?.name || order.buyer_name || addr?.recipient_name || 'General Public'
  const buyerTin = eDetails.customer?.tin || 'EI00000000010'
  const buyerIdNum = eDetails.customer?.id_number || 'NA'
  
  const isValidated = !!eInv?.qr_code_url || !!eInv?.lhdn_uuid || ['valid', 'submitted', 'individual_issued'].includes(eInv?.status)
  const lhdnUuid = eInv?.lhdn_uuid || eInv?.submission_uid
  const qrCodeUrl = eInv?.qr_code_url

  const html = `
    <html>
      <head>
        <title>Tax Invoice - ${order.order_number}</title>
        <style>
          @page { margin: 0; }
          body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; color: #1f2937; padding: 40px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; }
          .title-area h1 { font-size: 24px; font-weight: 800; color: #111827; margin: 0; text-transform: uppercase; letter-spacing: -0.025em; }
          .title-area p { margin: 4px 0 0; color: #6b7280; font-size: 12px; }
          
          .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
          .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #9ca3af; margin-bottom: 8px; letter-spacing: 0.05em; }
          
          .merchant-info h2 { font-size: 14px; font-weight: 700; margin: 0 0 4px; color: #111827; }
          .merchant-info p { margin: 2px 0; }
          
          .invoice-meta { text-align: right; }
          .meta-row { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 4px; }
          .meta-label { color: #6b7280; }
          .meta-value { font-weight: 600; color: #111827; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f9fafb; text-align: left; padding: 10px 12px; font-weight: 600; color: #4b5563; border-bottom: 1px solid #e5e7eb; }
          td { padding: 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
          
          .totals-area { display: flex; justify-content: flex-end; margin-top: 20px; }
          .totals-table { width: 250px; }
          .totals-table tr td { border: none; padding: 4px 0; }
          .total-grand { border-top: 2px solid #111827 !important; padding-top: 12px !important; margin-top: 8px; }
          .total-grand td { font-size: 14px; font-weight: 800; color: #111827; }
          
          .lhdn-footer { margin-top: 40px; padding: 20px; background: #f8fafc; border-radius: 12px; display: flex; gap: 20px; align-items: center; border: 1px solid #e2e8f0; }
          .qr-code { width: 80px; height: 80px; background: #fff; padding: 4px; border: 1px solid #e2e8f0; border-radius: 8px; }
          .lhdn-details { flex: 1; }
          .lhdn-details p { margin: 2px 0; font-family: monospace; font-size: 10px; color: #475569; }
          .validation-badge { display: inline-block; padding: 2px 8px; background: #dcfce7; color: #15803d; border-radius: 999px; font-size: 9px; font-weight: 700; margin-bottom: 8px; }
          
          .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #f3f4f6; color: #4b5563; font-size: 10px; font-weight: 600; }
          .footer-note { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 10px; border-top: 1px solid #f3f4f6; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>Tax Invoice</h1>
            <p>Generated on ${format(new Date(), 'd MMM yyyy, h:mm a')}</p>
          </div>
          <div class="invoice-meta">
            <div class="meta-row">
              <span class="meta-label">Invoice No:</span>
              <span class="meta-value">${order.order_number}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Date:</span>
              <span class="meta-value">${format(new Date(order.created_at), 'd MMM yyyy')}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Status:</span>
              <span class="badge">${order.payment_status?.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div class="info-grid">
          <div class="merchant-info">
            <div class="section-title">Supplier</div>
            <h2>${merchant?.store_name || 'Our Store'}</h2>
            <p>${merchant?.address_line1 || ''}${merchant?.address_line2 ? ', ' + merchant?.address_line2 : ''}</p>
            <p>${merchant?.postcode || ''} ${merchant?.city || ''}, ${merchant?.state || ''}</p>
            <p><strong>TIN:</strong> ${config?.tin || '—'} &nbsp; <strong>BRN:</strong> ${config?.brn || '—'}</p>
            <p><strong>MSIC:</strong> ${config?.msic_code || '47910'} (${config?.description || 'Retail via Internet'})</p>
            <p><strong>Contact:</strong> ${merchant?.phone || '—'} | ${merchant?.email || '—'}</p>
          </div>
          <div class="buyer-info">
            <div class="section-title">Buyer</div>
            <h2>${buyerName}</h2>
            <p>${addr?.line1 || ''}${addr?.line2 ? ', ' + addr?.line2 : ''}</p>
            <p>${addr?.postcode || ''} ${addr?.city || ''}, ${addr?.state || ''}</p>
            <p><strong>TIN:</strong> ${buyerTin}</p>
            <p><strong>ID No:</strong> ${buyerIdNum}</p>
            <p><strong>Contact:</strong> ${addr?.phone || order.buyer_email || '—'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px">#</th>
              <th>Description</th>
              <th style="text-align: center; width: 60px">Qty</th>
              <th style="text-align: right; width: 100px">Unit Price</th>
              <th style="text-align: right; width: 100px">Tax Amount</th>
              <th style="text-align: right; width: 100px">Total (MYR)</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((i, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>
                  <div style="font-weight: 600">${i.product_name}</div>
                  <div style="font-size: 9px; color: #6b7280">${i.variant_name || 'Standard'}</div>
                </td>
                <td style="text-align: center">${i.quantity}</td>
                <td style="text-align: right">${Number(i.unit_price).toFixed(2)}</td>
                <td style="text-align: right">0.00</td>
                <td style="text-align: right; font-weight: 600">${Number(i.line_total).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-area">
          <table class="totals-table">
            <tr>
              <td>Subtotal</td>
              <td style="text-align: right">RM ${Number(order.subtotal).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Delivery Fee</td>
              <td style="text-align: right">${order.delivery_fee > 0 ? `RM ${Number(order.delivery_fee).toFixed(2)}` : '0.00'}</td>
            </tr>
            ${order.discount_amount > 0 ? `
            <tr>
              <td style="color: #16a34a">Discounts</td>
              <td style="text-align: right; color: #16a34a">-RM ${Number(order.discount_amount).toFixed(2)}</td>
            </tr>` : ''}
            ${order.tax_amount > 0 ? `
            <tr>
              <td>Total Tax</td>
              <td style="text-align: right">RM ${Number(order.tax_amount).toFixed(2)}</td>
            </tr>` : ''}
            <tr class="total-grand">
              <td>TOTAL PAYABLE</td>
              <td style="text-align: right">RM ${Number(order.total_amount).toFixed(2)}</td>
            </tr>
          </table>
        </div>

        ${isValidated ? `
        <div class="lhdn-footer">
          <div class="qr-code">
            ${qrCodeUrl ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeUrl)}" style="width: 100%; height: 100%" />` : '<div style="font-size: 8px; text-align: center; color: #94a3b8; padding: 10px">QR Code Pending</div>'}
          </div>
          <div class="lhdn-details">
            <div class="validation-badge">LHDN VALIDATED</div>
            <p><strong>LHDN UUID:</strong> ${lhdnUuid || 'Pending assignment'}</p>
            <p><strong>E-Invoice ID:</strong> ${eInv?.lhdn_long_id || 'N/A'}</p>
            ${eInv?.validated_at ? `<p><strong>Validated Date:</strong> ${format(new Date(eInv.validated_at), 'd MMM yyyy, h:mm:ss a')}</p>` : ''}
            <p style="margin-top: 8px; color: #64748b; font-style: italic">Validated through IRBM MyInvois Portal</p>
          </div>
        </div>
        ` : `
        <div class="lhdn-footer" style="background: #fff; border-style: dashed">
          <div style="flex: 1; text-align: center; color: #94a3b8; font-size: 10px">
            This is a preliminary visual representation. LHDN validation details will appear here once the e-invoice is issued.
          </div>
        </div>
        `}

        <div class="footer-note">
          <p>Thank you for shopping with ${merchant?.store_name || 'us'}.</p>
          <p style="margin-top: 4px">This is a computer generated document. No signature is required.</p>
        </div>
      </body>
    </html>
  `
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  // Wait for images (QR code) to load before printing
  setTimeout(() => {
    win.print()
  }, 500)
}

/**
 * Updates an order status in Supabase
 */
export async function updateOrderStatus(orderId: string, newStatus: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      status: newStatus, 
      updated_at: new Date().toISOString(),
      // Add timestamp fields based on status
      ...(newStatus === 'confirmed' ? { confirmed_at: new Date().toISOString() } : {}),
      ...(newStatus === 'preparing' ? { preparing_at: new Date().toISOString() } : {}),
      ...(newStatus === 'ready_for_pickup' ? { ready_at: new Date().toISOString() } : {}),
      ...(newStatus === 'out_for_delivery' ? { dispatched_at: new Date().toISOString() } : {}),
      ...(newStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
    })
    .eq('id', orderId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Bulk updates order statuses
 */
export async function bulkUpdateOrderStatus(orderIds: string[], newStatus: string) {
  const supabase = createClient()
  const now = new Date().toISOString()
  
  const updates = { 
    status: newStatus, 
    updated_at: now,
    ...(newStatus === 'confirmed' ? { confirmed_at: now } : {}),
    ...(newStatus === 'preparing' ? { preparing_at: now } : {}),
    ...(newStatus === 'ready_for_pickup' ? { ready_at: now } : {}),
    ...(newStatus === 'out_for_delivery' ? { dispatched_at: now } : {}),
    ...(newStatus === 'delivered' ? { delivered_at: now } : {}),
  }

  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .in('id', orderIds)
    .select()

  if (error) throw error
  return data
}
import { invokeWorker } from './worker'

/**
 * Invokes Lalamove order creation
 */
export async function bookLalamoveOrder(orderId: string) {
  const { data, error } = await invokeWorker('lalamove/create-order', {
    body: { orderId }
  })
  if (error) throw error
  return data
}

/**
 * Invokes Lalamove order cancellation
 */
export async function cancelLalamoveOrder(orderId: string) {
  const { data, error } = await invokeWorker('lalamove/cancel', {
    body: { orderId }
  })
  if (error) throw error
  return data
}

/**
 * Syncs Lalamove status
 */
export async function syncLalamoveStatus(orderId: string) {
  const { data, error } = await invokeWorker('lalamove/status', {
    body: { orderId }
  })
  if (error) throw error
  return data
}

/**
 * Syncs EasyParcel order status
 */
export async function syncEasyParcelStatus(orderId: string) {
  const { data, error } = await invokeWorker('easyparcel-sync-order-status', {
    body: { order_id: orderId }
  })
  if (error) throw error
  return data
}

/**
 * Fetches EasyParcel delivery quotes/rates
 */
export async function getEasyParcelRates(orderId: string) {
  const { data, error } = await invokeWorker('get-delivery-quotes', {
    body: { orderId }
  })
  if (error) throw error
  return data
}
