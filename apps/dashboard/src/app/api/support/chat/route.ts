import { runSupportAgent } from '@project1/support-agent'
import { NextResponse } from 'next/server'

export const maxDuration = 60 // Allow more time for agent steps

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // Support both custom { newMessage } format and ai/react useChat { messages } format
    const newMessage: string = body.newMessage ?? body.messages?.at(-1)?.content
    const { sessionId, merchantId, customerEmail, customerName, orderId, customerId } = body

    if (!sessionId || !merchantId || !newMessage) {
      return NextResponse.json({
        error: 'Missing required parameters: sessionId, merchantId, and newMessage'
      }, { status: 400 })
    }

    console.log(`[API/Support/Chat] session=${sessionId} merchant=${merchantId} order=${orderId} msg=${newMessage.slice(0, 50)}...`)

    // Call orchestrator and return result
    // The orchestrator handles config checking, history loading, and session updates
    const response = await runSupportAgent({
      newMessage,
      sessionId,
      merchantId,
      customerId,
      customerEmail,
      customerName,
      orderId
    })

    // Expose session ID in response headers for context persistence
    response.headers.set('x-session-id', sessionId)
    response.headers.set('Access-Control-Expose-Headers', 'x-session-id')
    response.headers.set('X-Accel-Buffering', 'no')
    
    return response

  } catch (error: any) {
    console.error('[API/Support/Chat] Error:', error)
    return NextResponse.json({ 
      error: 'Support agent execution failed', 
      details: error.message 
    }, { status: 500 })
  }
}
