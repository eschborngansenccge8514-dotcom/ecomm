import { format } from 'date-fns'

/**
 * Generates and prints a Pick List for a fulfilment batch
 */
export function printPickList(fulfilment: any) {
  const items = fulfilment.fulfilment_items || []
  const order = fulfilment.order || {}
  
  const html = `
    <html>
      <head>
        <title>Pick List - ${fulfilment.fulfilment_number}</title>
        <style>
          @page { margin: 20mm; }
          body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; color: #1f2937; line-height: 1.5; padding: 0; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; }
          .title-area h1 { font-size: 24px; font-weight: 800; color: #111827; margin: 0; text-transform: uppercase; }
          .title-area p { margin: 4px 0 0; color: #6b7280; font-size: 12px; }
          
          .meta-row { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 4px; }
          .meta-label { color: #6b7280; }
          .meta-value { font-weight: 600; color: #111827; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f9fafb; text-align: left; padding: 10px 12px; font-weight: 700; color: #4b5563; border-bottom: 1px solid #e5e7eb; text-transform: uppercase; font-size: 10px; }
          td { padding: 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
          
          .barcode-img { height: 40px; margin-top: 5px; }
          .check-box { width: 18px; height: 18px; border: 2px solid #d1d5db; border-radius: 4px; display: inline-block; }
          
          .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 10px; border-top: 1px solid #f3f4f6; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>Pick List</h1>
            <p>Generated on ${format(new Date(), 'd MMM yyyy, h:mm a')}</p>
          </div>
          <div class="invoice-meta">
            <div class="meta-row">
              <span class="meta-label">Batch No:</span>
              <span class="meta-value">${fulfilment.fulfilment_number}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Order No:</span>
              <span class="meta-value">${order.order_number}</span>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px">Pick</th>
              <th>Item / Variant</th>
              <th>SKU</th>
              <th style="width: 150px">Barcode</th>
              <th style="text-align: center; width: 60px">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((i: any) => `
              <tr>
                <td style="text-align: center"><div class="check-box"></div></td>
                <td>
                  <div style="font-weight: 700; font-size: 13px">${i.product?.name || 'Unknown Product'}</div>
                  <div style="font-size: 11px; color: #6b7280">${i.variant?.name || 'Standard'}</div>
                </td>
                <td style="font-family: monospace; font-size: 11px">${i.variant?.sku || i.product?.sku || 'N/A'}</td>
                <td>
                  ${i.barcode ? `
                    <div style="text-align: center">
                      <img src="https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(i.barcode)}&code=Code128&multiplebarcodes=false" class="barcode-img" />
                      <div style="font-size: 9px; font-family: monospace; margin-top: 2px">${i.barcode}</div>
                    </div>
                  ` : '<div style="color: #9ca3af; font-size: 9px italic">No barcode</div>'}
                </td>
                <td style="text-align: center; font-size: 16px; font-weight: 900">${i.quantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Please double check quantities and variants before packing.</p>
        </div>
      </body>
    </html>
  `
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 1000)
}

/**
 * Generates and prints a Packing Slip
 */
export function printPackingSlip(fulfilment: any) {
  const items = fulfilment.fulfilment_items || []
  const order = fulfilment.order || {}
  const addr = order.delivery_address || {}
  
  const html = `
    <html>
      <head>
        <title>Packing Slip - ${fulfilment.fulfilment_number}</title>
        <style>
          @page { margin: 15mm; }
          body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; color: #1f2937; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
          .title-area h1 { font-size: 20px; font-weight: 800; margin: 0; }
          
          .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
          .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #9ca3af; margin-bottom: 8px; }
          
          .address-box h2 { font-size: 14px; font-weight: 700; margin: 0 0 4px; }
          .address-box p { margin: 2px 0; }
          
          table { width: 100%; border-collapse: collapse; }
          th { background: #f9fafb; text-align: left; padding: 10px; font-weight: 700; border-bottom: 2px solid #e5e7eb; }
          td { padding: 10px; border-bottom: 1px solid #f3f4f6; }
          
          .footer { margin-top: 50px; text-align: center; border-top: 1px dashed #e5e7eb; padding-top: 20px; font-size: 10px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>Packing Slip</h1>
            <p>Order #${order.order_number}</p>
          </div>
          <div style="text-align: right">
            <p><strong>Batch:</strong> ${fulfilment.fulfilment_number}</p>
            <p><strong>Date:</strong> ${format(new Date(fulfilment.created_at), 'd MMM yyyy')}</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="address-box">
            <div class="section-title">Ship To</div>
            <h2>${addr.recipient_name || order.customer?.full_name || 'Customer'}</h2>
            <p>${addr.line1 || ''}</p>
            <p>${addr.line2 || ''}</p>
            <p>${addr.postcode || ''} ${addr.city || ''}, ${addr.state || ''}</p>
            <p>T: ${addr.phone || ''}</p>
          </div>
          <div class="address-box">
            <div class="section-title">Delivery Method</div>
            <p style="font-weight: 700; font-size: 14px; color: #3b82f6; text-transform: uppercase;">
              ${order.delivery_provider || 'Standard'} - ${order.delivery_type || 'Delivery'}
            </p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center; width: 60px">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((i: any) => `
              <tr>
                <td>
                  <div style="font-weight: 700">${i.product?.name}</div>
                  <div style="font-size: 10px; color: #6b7280">${i.variant?.name || 'Standard'}</div>
                </td>
                <td style="text-align: center; font-weight: 700; font-size: 14px">${i.quantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Thank you for your order!</p>
          <p>Should you have any questions, please contact us at support@ourstore.com</p>
        </div>
      </body>
    </html>
  `
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 1000)
}
