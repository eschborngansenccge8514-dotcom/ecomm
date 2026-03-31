const nodemailer = require('nodemailer');

// Transporter per merchant sender — cached to avoid recreating on every email
const _transporters = new Map();

function getTransporter() {
  const key = `${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`;
  if (_transporters.has(key)) return _transporters.get(key);

  const t = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  _transporters.set(key, t);
  return t;
}

/**
 * Send invoice confirmation email to customer.
 */
async function sendInvoiceEmail(merchant, { customerEmail, customerName, orderNumber, qrCodeUrl, uuid, invoiceType = 'invoice' }) {
  if (!customerEmail || customerEmail === 'noreply@einvoice.my') return;

  const typeLabels = {
    'invoice':     'e-Invoice',
    'credit-note': 'Credit Note',
    'debit-note':  'Debit Note',
    'refund-note': 'Refund Note',
    'consolidated':'Consolidated e-Invoice',
  };
  const label = typeLabels[invoiceType] || 'e-Invoice';

  await getTransporter().sendMail({
    from:    `"${merchant.name}" <${merchant.email || process.env.SMTP_USER}>`,
    to:      customerEmail,
    subject: `Your ${label} for Order #${orderNumber} — ${merchant.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Arial,sans-serif; max-width:600px; margin:auto; padding:20px;">
        <h2 style="color:#1a1a1a;">${merchant.name}</h2>
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
          ${merchant.name} (TIN: ${merchant.tin}).
        </p>
      </body>
      </html>
    `,
  });

  console.log(`[Mailer] Invoice email sent — Merchant: ${merchant.merchant_uid}, To: ${customerEmail}`);
}

module.exports = { sendInvoiceEmail };
