import { streamText, tool } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, cartContext } = await req.json()

  const result = await streamText({
    model: google('gemini-3.1-flash-lite-preview'),
    messages,
    system: `You are MerchantMind POS Assistant. 
    You help the cashier manage the current sale.
    Cart Context: ${JSON.stringify(cartContext)}
    
    You can apply discounts, find products, and add customers.
    Be concise and professional.`,
    tools: {
      applyDiscount: {
        description: 'Apply a global discount to the current cart',
        parameters: z.object({
          amountRm: z.number().describe('Fixed amount in RM to discount'),
          reason: z.string().optional()
        }),
        execute: async ({ amountRm }: any) => ({ success: true, newDiscount: amountRm })
      },
      addCustomer: {
        description: 'Add or search for a customer to link to the sale',
        parameters: z.object({
          query: z.string().describe('Name or phone number')
        }),
        execute: async ({ query }: any) => ({ success: true, customer: { id: 'mock-123', name: query } })
      }
    } as any
  })

  return result.toTextStreamResponse()
}
