import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard } from '../middleware/executor'
import { sendEmail, FROM_ADDRESSES } from '@repo/email'

/**
 * Communication Tools
 * 
 * Allows the agent to interact with external parties via email and potentially other channels.
 */

// Tool 1: Send a general email — medium risk (logging only, no blocking)
export const sendEmailTool = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Send a one-to-one email to a specific recipient. Use this for manual outreach, follow-ups, or custom notifications. For bulk promotional emails to segments, use send_marketing_campaign instead.',
    parameters: z.object({
      to:        z.string().email().optional().describe('Recipient email address'),
      recipient: z.string().email().optional().describe('Alias for "to" (use if you only have one email)'),
      subject:   z.string().min(1).describe('Email subject line'),
      body:      z.string().min(1).describe('The plain text or HTML content of the email'),
      from_name: z.string().optional().describe('Optional sender name (defaults to business name)')
    }).refine(data => data.to || data.recipient, {
      message: 'Missing recipient email (to or recipient)'
    }),
    execute: (input: any) =>
      executeWithGuard(
        'send_email',
        input,
        {
          riskLevel: 'medium',
          approvalTitle: (i) => `Send email to ${i.to || i.recipient}`,
          approvalDescription: (i) => `Subject: ${i.subject}\n\n${i.body.substring(0, 200)}${i.body.length > 200 ? '...' : ''}`
        },
        merchantId,
        sessionId,
        async () => {
          const finalRecipient = input.to || input.recipient;
          if (!finalRecipient) throw new Error('Missing recipient email (to or recipient)');

          const result = await sendEmail({
            from: input.from_name 
              ? `${input.from_name} <${FROM_ADDRESSES.transactional.split('<')[1]}` 
              : FROM_ADDRESSES.transactional,
            to: finalRecipient,
            subject: input.subject,
            html: input.body, 
          }, {
            templateName: 'agent-custom',
            metadata: {
              session_id: sessionId,
              agent_triggered: true
            }
          });

          if (!result.success) {
            throw new Error(result.error);
          }

          return { success: true, resend_id: result.id };
        }
      )
  } as any)
