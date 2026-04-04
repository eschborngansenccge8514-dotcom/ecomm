const nodemailer = require('nodemailer');
const { Resend }   = require('resend');
const config     = require('../config');

class EmailService {
  constructor() {
    this.service = config.EMAIL.SERVICE.toLowerCase();
    this.transporter = null;
    this.resend = null;

    if (this.service === 'resend') {
      if (!config.EMAIL.RESEND_API_KEY) {
        console.warn('[EmailService] Resend API Key missing. Falling back to SMTP.');
        this.service = 'smtp';
      } else {
        this.resend = new Resend(config.EMAIL.RESEND_API_KEY);
      }
    }

    if (this.service === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: config.EMAIL.SMTP.HOST,
        port: config.EMAIL.SMTP.PORT,
        auth: {
          user: config.EMAIL.SMTP.USER,
          pass: config.EMAIL.SMTP.PASS,
        },
      });
    }
  }

  /**
   * Generic send function
   * @param {Object} options
   * @param {string} options.from
   * @param {string} options.to
   * @param {string} options.subject
   * @param {string} [options.html]
   * @param {string} [options.text]
   * @param {string} [options.templateId] - Resend template ID
   * @param {Object} [options.variables]   - Resend template variables
   */
  async sendMail({ from, to, subject, html, text, templateId, variables }) {
    if (this.service === 'resend' && this.resend) {
      const payload = {
        from:    from || config.EMAIL.FROM,
        to:      [to],
        subject: subject,
      };

      if (templateId) {
        // Use Resend Template API if ID is provided
        payload.template = {
          id: templateId,
          variables: variables || {},
        };
      } else {
        // Fallback to direct HTML/Text
        if (html) payload.html = html;
        if (text) payload.text = text;
      }

      const { data, error } = await this.resend.emails.send(payload);
      if (error) {
        throw new Error(`[Resend] Email failed: ${error.message}`);
      }
      return data;
    } else {
      // SMTP (Nodemailer)
      if (!this.transporter) throw new Error('[EmailService] SMTP Transporter not initialized');

      return await this.transporter.sendMail({
        from:    from || config.EMAIL.FROM,
        to:      to,
        subject: subject,
        html:    html,
        text:    text,
      });
    }
  }
}

// Singleton instance
module.exports = new EmailService();
