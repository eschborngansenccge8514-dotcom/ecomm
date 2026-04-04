import { Resend } from "https://esm.sh/resend@3.2.0";

export interface EmailOptions {
  from?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export class EmailService {
  private resend: Resend;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('[EmailService] Resend API Key is required');
    }
    this.resend = new Resend(apiKey);
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

    return await this.resend.emails.send({
      from,
      to: [customerEmail],
      subject,
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
}
