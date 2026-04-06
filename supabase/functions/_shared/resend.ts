import { Resend } from "https://esm.sh/resend@3.2.0";
import { getSupabaseClient } from "./supabase.ts";

export interface EmailOptions {
  from?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templateName?: string;
}

export class EmailService {
  private resend: Resend;
  private supabase = getSupabaseClient();

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('[EmailService] Resend API Key is required');
    }
    this.resend = new Resend(apiKey);
  }

  private async logEmail(details: {
    resendId?: string;
    template: string;
    recipient: string;
    status: string;
    error?: string;
    metadata?: any;
  }) {
    try {
      await this.supabase.from('email_logs').insert({
        resend_id: details.resendId,
        template: details.template,
        recipient: details.recipient,
        status: details.status,
        error: details.error,
        metadata: details.metadata
      });
    } catch (logError) {
      console.error('[EmailService] Failed to log email:', logError);
    }
  }

  async sendEmail(options: EmailOptions) {
    const { from, to, subject, html, text, templateName = 'generic' } = options;
    const recipient = Array.isArray(to) ? to[0] : to;

    try {
      const { data, error } = await this.resend.emails.send({
        from: from || '"Hyperlocal" <noreply@einvoice.my>',
        to,
        subject,
        html,
        text,
      });

      if (error) {
        await this.logEmail({
          template: templateName,
          recipient,
          status: 'failed',
          error: error.message,
          metadata: { subject }
        });
        return { success: false, error: error.message };
      }

      await this.logEmail({
        resendId: data?.id,
        template: templateName,
        recipient,
        status: 'sent',
        metadata: { subject }
      });

      return { success: true, id: data?.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.logEmail({
        template: templateName,
        recipient,
        status: 'failed',
        error: message,
        metadata: { subject }
      });
      return { success: false, error: message };
    }
  }

  async sendInvoiceEmail(merchant: any, details: {
    customerEmail: string;
    customerName: string;
    orderNumber: string;
    qrCodeUrl: string;
    uuid: string;
    invoiceType?: string;
  }) {
    const { customerEmail, customerName, orderNumber, qrCodeUrl, uuid, invoiceType = 'invoice' } = details;

    if (!customerEmail || customerEmail === 'noreply@einvoice.my' || customerEmail === 'noreply@customer.com') return;

    const typeLabels: Record<string, string> = {
      'invoice':      'e-Invoice',
      'individual':   'e-Invoice',
      'credit-note':  'Credit Note',
      'debit-note':   'Debit Note',
      'refund-note':  'Refund Note',
      'consolidated': 'Consolidated e-Invoice',
    };
    const label = typeLabels[invoiceType] || 'e-Invoice';
    const subject = `Your ${label} for Order #${orderNumber} — ${merchant.store_name || merchant.name}`;
    const from = `"${merchant.store_name || merchant.name}" <noreply@einvoice.my>`;

    return await this.sendEmail({
      from,
      to: [customerEmail],
      subject,
      templateName: 'invoice',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family:Arial,sans-serif; max-width:600px; margin:auto; padding:20px;">
          <h2 style="color:#1a1a1a;">${merchant.store_name || merchant.name}</h2>
          <hr/>
          <p>Dear ${customerName || 'Valued Customer'},</p>
          <p>
            Your official <strong>${label}</strong> has been validated by LHDN
            and is now available for download and verification.
          </p>
          <table style="width:100%; border-collapse:collapse; margin:20px 0;">
            <tr>
              <td style="padding:8px; color:#666; width:40%;">Order Number</td>
              <td style="padding:8px;"><strong>${orderNumber}</strong></td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:8px; color:#666;">Document Type</td>
              <td style="padding:8px;">${label}</td>
            </tr>
            <tr>
              <td style="padding:8px; color:#666;">LHDN Invoice ID</td>
              <td style="padding:8px; font-size:12px; color:#555;">${uuid}</td>
            </tr>
          </table>
          <div style="text-align:center; margin:30px 0;">
            <a href="${qrCodeUrl}" style="
              background:#1a73e8; color:#fff; padding:14px 28px;
              border-radius:6px; text-decoration:none; font-size:16px;
            ">
              View &amp; Verify e-Invoice
            </a>
          </div>
          <p style="color:#999; font-size:12px;">
            You can verify the authenticity of this invoice by clicking the button above
            or visiting the MyInvois portal. This invoice was issued on behalf of
            ${merchant.store_name || merchant.name}.
          </p>
        </body>
        </html>
      `
    });
  }

  async sendPurchaseOrderEmail(merchant: any, po: any, items: any[], supplier: any) {
    const { po_number, order_date, expected_date, subtotal, total, notes } = po;
    const { email: supplierEmail, name: supplierName } = supplier;

    if (!supplierEmail) {
      console.warn(`[EmailService] Skipping PO #${po_number} email: No supplier email`);
      return;
    }

    const storeName = merchant.store_name || merchant.name || 'Our Store';
    const subject = `Purchase Order ${po_number} — ${storeName}`;
    const from = `"${storeName}" <noreply@einvoice.my>`;

    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      return new Date(dateStr).toLocaleDateString('en-MY', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    };

    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding:8px; border-bottom:1px solid #eee;">${item.products?.name || 'Product'}</td>
        <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${item.quantity_ordered}</td>
        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">RM${item.unit_cost.toFixed(2)}</td>
        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;"><strong>RM${item.total.toFixed(2)}</strong></td>
      </tr>
    `).join('');

    return await this.sendEmail({
      from,
      to: [supplierEmail],
      subject,
      templateName: 'purchase_order',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family:Arial,sans-serif; max-width:600px; margin:auto; padding:20px; color:#333;">
          <h2 style="color:#1a1a1a; margin-bottom:5px;">${storeName}</h2>
          <p style="color:#666; margin-top:0;">Purchase Order</p>
          <hr style="border:none; border-top:1px solid #eee; margin:20px 0;"/>
          
          <p>Dear ${supplierName || 'Supplier'},</p>
          <p>Please find our purchase order <strong>#${po_number}</strong> details below:</p>

          <table style="width:100%; border-collapse:collapse; margin:20px 0; background:#f9f9f9; border-radius:8px;">
            <tr>
              <td style="padding:12px; color:#666;">PO Number</td>
              <td style="padding:12px;"><strong>${po_number}</strong></td>
            </tr>
            <tr style="border-top:1px solid #eee;">
              <td style="padding:12px; color:#666;">Order Date</td>
              <td style="padding:12px;">${formatDate(order_date)}</td>
            </tr>
            <tr style="border-top:1px solid #eee;">
              <td style="padding:12px; color:#666;">Expected Delivery</td>
              <td style="padding:12px;">${formatDate(expected_date)}</td>
            </tr>
          </table>

          <table style="width:100%; border-collapse:collapse; margin:20px 0;">
            <thead>
              <tr style="background:#eee;">
                <th style="padding:8px; text-align:left;">Item</th>
                <th style="padding:8px; text-align:center;">Qty</th>
                <th style="padding:8px; text-align:right;">Unit Cost</th>
                <th style="padding:8px; text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding:8px; text-align:right; color:#666;">Subtotal</td>
                <td style="padding:8px; text-align:right;">RM${subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td colspan="3" style="padding:8px; text-align:right; color:#666;"><strong>Total</strong></td>
                <td style="padding:8px; text-align:right; font-size:18px;"><strong>RM${total.toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>

          ${notes ? `
            <div style="margin:20px 0; padding:15px; border-left:4px solid #eee; background:#fcfcfc;">
              <strong style="color:#666; font-size:12px; display:block; margin-bottom:5px;">NOTES</strong>
              <p style="margin:0;">${notes}</p>
            </div>
          ` : ''}

          <p style="margin-top:30px; font-size:14px; color:#666;">
            If you have any questions, please contact us at your earliest convenience.<br/>
            Thank you for your business.
          </p>
        </body>
        </html>
      `
    });
  }

  async sendOrderConfirmation(merchant: any, order: any, items: any[]) {
    const storeName = merchant.store_name || merchant.name || 'Merchant';
    const from = `"${storeName}" <orders@mail.yourdomain.com>`;
    const subject = `Order Confirmed: #${order.order_number}`;

    const itemsHtml = items.map(item => `
      <li>${item.product_name} x ${item.quantity} - RM${item.line_total.toFixed(2)}</li>
    `).join('');

    return await this.sendEmail({
      from,
      to: order.buyer_email || order.profiles?.email,
      subject,
      templateName: 'order_confirmation',
      html: `
        <h2>Thanks for your order, ${order.buyer_name || 'Customer'}!</h2>
        <p>Your order <strong>#${order.order_number}</strong> from ${storeName} has been received.</p>
        <ul>${itemsHtml}</ul>
        <p><strong>Total Amount: RM${order.total_amount.toFixed(2)}</strong></p>
      `
    });
  }

  async sendOrderStatusUpdate(merchant: any, order: any) {
    const storeName = merchant.store_name || merchant.name || 'Merchant';
    const from = `"${storeName}" <orders@mail.yourdomain.com>`;
    const subject = `Update on Order #${order.order_number}`;

    const statusMap: any = {
      'confirmed': 'confirmed and is being processed.',
      'preparing': 'being prepared for you.',
      'ready_for_pickup': 'ready for pickup!',
      'out_for_delivery': 'out for delivery!',
      'delivered': 'delivered. Enjoy!',
      'cancelled': 'cancelled.',
    };

    return await this.sendEmail({
      from,
      to: order.buyer_email || order.profiles?.email,
      subject,
      templateName: 'order_status_update',
      html: `
        <h2>Order Update</h2>
        <p>Hi ${order.buyer_name || 'Customer'},</p>
        <p>Your order <strong>#${order.order_number}</strong> from ${storeName} is now <strong>${statusMap[order.status] || order.status}</strong>.</p>
      `
    });
  }

  async sendMerchantNewOrderAlert(merchant: any, order: any) {
    const subject = `New Order Received: #${order.order_number}`;
    const from = '"Hyperlocal Notifications" <no-reply@mail.yourdomain.com>';

    return await this.sendEmail({
      from,
      to: merchant.email,
      subject,
      templateName: 'merchant_new_order',
      html: `
        <h2>New Order Received!</h2>
        <p>You have a new order: <strong>#${order.order_number}</strong></p>
        <p>Total: RM${order.total_amount.toFixed(2)}</p>
        <p><a href="https://dashboard.yourdomain.com/orders/${order.id}">View Order in Dashboard</a></p>
      `
    });
  }

  async sendLowStockAlert(merchant: any, product: any, variant?: any) {
    const subject = `Low Stock Alert: ${product.name}${variant ? ` (${variant.name})` : ''}`;
    const from = '"Hyperlocal Inventory" <no-reply@mail.yourdomain.com>';
    const stock = variant ? variant.stock_quantity : product.stock_quantity;

    return await this.sendEmail({
      from,
      to: merchant.email,
      subject,
      templateName: 'low_stock_alert',
      html: `
        <h2>Low Stock Alert</h2>
        <p>The following item is low on stock:</p>
        <p><strong>${product.name}</strong> ${variant ? `(${variant.name})` : ''}</p>
        <p>Current stock: <strong>${stock}</strong></p>
        <p>Restock Threshold: <strong>${product.restock_threshold || product.low_stock_alert}</strong></p>
        <p><a href="https://dashboard.yourdomain.com/inventory">Manage Inventory</a></p>
      `
    });
  }

  async sendConsumerWelcome(user: any) {
    const subject = 'Welcome to Hyperlocal!';
    const from = '"Hyperlocal" <welcome@mail.yourdomain.com>';

    return await this.sendEmail({
      from,
      to: user.email,
      subject,
      templateName: 'consumer_welcome',
      html: `
        <h2>Welcome to Hyperlocal!</h2>
        <p>Thanks for joining our community. You can now discover local merchants and order directly from our app.</p>
        <p><a href="https://hyperlocal.app/download">Download our Mobile App</a></p>
      `
    });
  }
}

