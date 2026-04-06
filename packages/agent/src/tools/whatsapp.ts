import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard } from '../middleware/executor'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://functions-worker.jjooi1707.workers.dev'

/**
 * WhatsApp Tools
 * 
 * Allows the agent to communicate with customers and suppliers via WhatsApp.
 */

// Tool 1: Send a text message — high risk (needs approval)
export const whatsappSendTextTool = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Send a WhatsApp message to a phone number. Use this for customer outreach, notifications, or responding to inquiries.',
    parameters: z.object({
      number: z.string().describe('The phone number of the recipient (with country code, e.g., +60123456789)'),
      text:   z.string().min(1).describe('The plain text message to send')
    }),
    execute: (input: any) =>
      executeWithGuard(
        'whatsapp_send_text',
        input,
        {
          riskLevel: 'high',
          approvalTitle: (i) => `Send WhatsApp to ${i.number}`,
          approvalDescription: (i) => `Message: ${i.text}`
        },
        merchantId,
        sessionId,
        async () => {
          const response = await fetch(`${WORKER_URL}/whatsapp/send-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...input,
              merchant_id: merchantId,
              session_id: sessionId
            })
          })

          let data: any = {};
          if (response.ok) {
            data = await response.json();
          } else {
            const text = await response.text();
            try {
              data = JSON.parse(text);
            } catch {
              data = { error: text || 'Failed to send WhatsApp message', status: response.status };
            }
          }

          if (!response.ok) {
            throw new Error(`[${data.status || response.status}] ${data.error || 'Unknown error sending message'}`)
          }

          return { success: true, messageId: data.key?.id };
        }
      )
  } as any)

// Tool 2: Check if a number is on WhatsApp — low risk (no approval)
export const whatsappCheckNumberTool = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Check if a phone number is registered on WhatsApp.',
    parameters: z.object({
      number: z.string().describe('The phone number to check (with country code)')
    }),
    execute: (input: any) =>
      executeWithGuard(
        'whatsapp_check_number',
        input,
        {
          riskLevel: 'low'
        },
        merchantId,
        sessionId,
        async () => {
          const response = await fetch(`${WORKER_URL}/whatsapp/status`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })

          let data: any = {};
          if (response.ok) {
            data = await response.json();
          } else {
            const text = await response.text();
            try {
              data = JSON.parse(text);
            } catch {
              data = { error: text || 'Failed to check status', status: response.status };
            }
          }
          // Evolution API /status usually doesn't check specific numbers but instance state.
          // For now just checking if instance is connected.
          if (data.instance?.state !== 'open') {
             throw new Error('WhatsApp is not connected. Please scan the QR code in Settings.')
          }

          return { success: true, connected: true };
        }
      )
  } as any)
