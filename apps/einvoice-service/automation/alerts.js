const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send failure alert to ops team.
 */
async function sendFailureAlert({ merchantId, merchantName, jobId, jobType, orderNumber, error, attempts }) {
  const subject = `⚠️ e-Invoice Failed — [${merchantId}] ${orderNumber || jobId}`;
  const text = `
Merchant:     ${merchantName || merchantId}
Merchant UID: ${merchantId}
Job ID:       ${jobId}
Job Type:     ${jobType}
Order:        ${orderNumber || 'N/A'}
Error:        ${error}
Attempts:     ${attempts}
Time:         ${new Date().toISOString()}

Action required: Review failed job in /admin/merchants/${merchantId}/dlq
  `.trim();

  // Email ops team
  if (process.env.ALERT_TO) {
    await transporter.sendMail({
      from:    process.env.ALERT_FROM,
      to:      process.env.ALERT_TO,
      subject, text,
    }).catch(e => console.error('[Alert] Email failed:', e.message));
  }

  // Slack alert
  if (process.env.SLACK_WEBHOOK_URL) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `*${subject}*\n\`\`\`${text}\`\`\``,
      }),
    }).catch(e => console.error('[Alert] Slack failed:', e.message));
  }

  console.log(`[Alert] Failure alert sent — Merchant: ${merchantId}, Job: ${jobId}`);
}

/**
 * Send weekly DLQ health report to ops team
 */
async function sendDLQHealthReport(summary) {
  if (!summary.totalFailed || summary.totalFailed === 0) return;

  const rows   = summary.merchants.map(m =>
    `  - ${m.merchantId}: ${m.failedCount} failed job(s)`
  ).join('\n');

  const subject = `📊 Weekly e-Invoice DLQ Report — ${summary.totalFailed} failed job(s)`;
  const text    = `
Weekly Dead Letter Queue Summary
Generated: ${new Date().toISOString()}

Total failed jobs: ${summary.totalFailed}
Affected merchants:
${rows}

Review at: ${process.env.ADMIN_URL || '/admin'}/dlq
  `.trim();

  if (process.env.ALERT_TO) {
    await transporter.sendMail({
      from: process.env.ALERT_FROM,
      to:   process.env.ALERT_TO,
      subject, text,
    }).catch(e => console.error('[Alert] DLQ report email failed:', e.message));
  }

  if (process.env.SLACK_WEBHOOK_URL) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `*${subject}*\n\`\`\`${text}\`\`\`` }),
    }).catch(() => {});
  }
}

module.exports = { sendFailureAlert, sendDLQHealthReport };
