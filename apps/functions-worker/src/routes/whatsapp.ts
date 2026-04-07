import { Hono } from 'hono'
import { Bindings, getSupabaseClient } from '../lib/supabase'
import { injectEnv } from '../env_shim'
import { handleMerchantWhatsApp, extractReceiptData } from '@project1/agent'
import { handleWhatsAppMessage, createSupportSession } from '@project1/support-agent'

const whatsapp = new Hono<{ Bindings: Bindings }>()

const getHeaders = (env: Bindings) => ({
  'Content-Type': 'application/json',
  'apikey': env.EVOLUTION_API_KEY
})

// --- Instance Management ---

// Connect/Get QR Code
whatsapp.get('/qr', async (c) => {
  const instanceName = c.env.WHATSAPP_INSTANCE_NAME || 'main'
  console.log(`[WhatsApp] Getting QR for ${instanceName}`)
  try {
    const statusRes = await fetch(`${c.env.EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
      headers: getHeaders(c.env)
    })
    
    if (statusRes.ok) {
       const statusData = await statusRes.json() as any
       if (statusData.instance?.state === 'open') {
         return c.json({ success: true, status: 'connected' })
       }
    }

    const connectRes = await fetch(`${c.env.EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
      headers: getHeaders(c.env)
    })
    
    const connectData = await connectRes.json() as any
    if (connectData.code) {
        return c.json({ success: true, status: 'qr', qr: connectData.code, base64: connectData.base64 })
    }

    // Try to create if not found
    if (connectRes.status === 404 || (connectData.error && connectData.error.includes('does not exist'))) {
       const createRes = await fetch(`${c.env.EVOLUTION_API_URL}/instance/create`, {
         method: 'POST',
         headers: getHeaders(c.env),
         body: JSON.stringify({ instanceName, token: '', qrcode: true })
       })
       const createData = await createRes.json() as any
       if (createData.qrcode?.base64) {
           return c.json({ success: true, status: 'qr', qr: createData.qrcode.code, base64: createData.qrcode.base64 })
       }
    }

    return c.json({ success: false, error: 'Failed to fetch QR code', details: connectData })
  } catch (err: any) {
    console.error(`[WhatsApp] Error in /qr:`, err)
    return c.json({ success: false, error: err.message }, 500)
  }
})

// Check Status
whatsapp.get('/status', async (c) => {
  const instanceName = c.env.WHATSAPP_INSTANCE_NAME || 'main'
  try {
    const res = await fetch(`${c.env.EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
      headers: getHeaders(c.env)
    })
    const data = await res.json() as any
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Logout
whatsapp.post('/logout', async (c) => {
  const instanceName = c.env.WHATSAPP_INSTANCE_NAME || 'main'
  try {
    const res = await fetch(`${c.env.EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: getHeaders(c.env)
    })
    const data = await res.json() as any
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// --- Messaging ---

// Send Text
whatsapp.post('/send-text', async (c) => {
  const instanceName = c.env.WHATSAPP_INSTANCE_NAME || 'main'
  try {
    const body = await c.req.json(); 
    const number = body.number || body.phone_number;
    const text = body.text || body.message;
    const { merchant_id, session_id } = body;

    if (!number || !text) return c.json({ error: 'number and text required' }, 400)

    let formattedNumber = number.replace(/\D/g, '')
    if (!formattedNumber.includes('@')) {
        formattedNumber += '@s.whatsapp.net'
    }

    const res = await fetch(`${c.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: getHeaders(c.env),
      body: JSON.stringify({
        number: formattedNumber,
        options: { delay: 1200, presence: 'composing' },
        text
      })
    })

    const data = await res.json() as any

    if (merchant_id && (res.ok || data.key)) {
      try {
        const supabase = getSupabaseClient(c.env)
        await supabase
          .from('whatsapp_messages')
          .insert({
            merchant_id,
            session_id,
            recipient_number: formattedNumber,
            message_content: text,
            evolution_message_id: data.key?.id || data.message?.key?.id,
            status: 'sent',
            direction: 'outbound'
          })
      } catch (logErr) {
        console.error('[WhatsApp] Log Err:', logErr)
      }
    }

    return c.json(data)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// --- Webhooks ---

whatsapp.post('/webhook/*', async (c) => {
  const body = await c.req.json()
  const urlParts = c.req.path.split('/')
  const urlEvent = urlParts[urlParts.length - 1]
  const event = body.event || urlEvent

  console.log(`[WhatsApp Webhook] Received Event: ${event} from Instance: ${body.instance}`)
  console.log('[WhatsApp Webhook] Raw Body:', JSON.stringify(body, null, 2))

  if (event !== 'messages.upsert') {
    console.log(`[WhatsApp Webhook] Ignoring event: ${event}`)
    return c.json({ success: true, ignored: true })
  }

  const message = body.data?.message
  const data = body.data
  const messageId = data.key?.id

  if (!message) {
    console.log(`[WhatsApp Webhook] Ignoring empty message data for: ${body.instance}`)
    return c.json({ success: true, ignored: 'empty' })
  }

  // To allow merchants to chat with their AI (which results in fromMe: true),
  // we must check if this message ID was already sent by our worker to avoid infinite loops.
  if (data.key?.fromMe) {
    const supabase = getSupabaseClient(c.env)
    const { data: existing } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('evolution_message_id', messageId)
      .eq('direction', 'outbound')
      .maybeSingle()
    
    if (existing) {
      console.log(`[WhatsApp Webhook] Ignoring loop-back message: ${messageId}`)
      return c.json({ success: true, ignored: 'loop_back' })
    }
  }

  let messageText = message.conversation || message.extendedTextMessage?.text
  
  // If it's an image or document, attempt to extract receipt data
  let isMediaDetails = false
  if (message.imageMessage || message.documentMessage) {
     const mimeType = message.imageMessage?.mimetype || message.documentMessage?.mimetype
     // Evolution API can provide base64 right in the webhook if configured,
     // or we expect the message to have a base64 field from some other extension.
     // Also checking if it is image/jpeg, image/png, etc or pdf
     if (mimeType?.includes('image') || mimeType?.includes('pdf')) {
        let base64Data = ''
        if (data.message?.base64) {
           base64Data = data.message.base64
        } else if (message.imageMessage?.url) {
           // We might need to handle this manually if webhook base64 is off, 
           // but let's try calling Evolution API getBase64 as fallback
           try {
             const res = await fetch(`${c.env.EVOLUTION_API_URL}/chat/getBase64/${body.instance}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': c.env.EVOLUTION_API_KEY || '' },
                body: JSON.stringify({ message: message }) // Send the raw message object
             }).catch(() => null)
             
             if (res && res.ok) {
                const b64Json = await res.json() as any
                base64Data = b64Json.base64
             }
           } catch(e) { console.error('Failed to get bases64', e) }
        }
        
        if (base64Data) {
            try {
              // Re-inject environment variables since this is detached/running in Edge sometimes
              // though right now we're still in the main request handler (synchronous phase)
              // We'll put this logic inside waitUntil to ensure it works, but wait -
              // If we put it in wait until, it's safer. Let's do it immediately for now 
              // Wait, the process gets base64 then sends to extractReceiptData
              
              // We convert base64 to buffer for the AI sdk
              const buffer = Buffer.from(base64Data, 'base64')
              
              const extraction = await extractReceiptData(buffer as unknown as ArrayBuffer, mimeType as any)
              
              const attachedText = `[User sent a receipt image. Extracted Details: ${JSON.stringify(extraction, null, 2)}] \nPlease record this expense if clear, and let me know.`
              messageText = (messageText ? messageText + '\n\n' : '') + attachedText
              isMediaDetails = true
            } catch(e) {
              console.error('Failed to extract receipt', e)
              const attachedText = '[User sent an image but AI failed to parse receipt details.]'
              messageText = (messageText ? messageText + '\n\n' : '') + attachedText
              isMediaDetails = true
            }
        }
     }
  }

  if (!messageText && !isMediaDetails) {
    return c.json({ success: true, ignored: 'non_text' })
  }

  const remoteJid = data.key?.remoteJid
  const isFromMe = !!data.key?.fromMe
  const instanceName = body.instance

  if (!remoteJid || !instanceName) {
    console.log(`[WhatsApp Webhook] Missing info: remoteJid=${remoteJid}, instance=${instanceName}`)
    return c.json({ success: false, error: 'missing_info' })
  }

  // The conversation we're in (reply target)
  const conversationJid = remoteJid

  c.executionCtx.waitUntil((async () => {
    try {
      // Re-inject env inside the async task since waitUntil runs detached from the request lifecycle
      injectEnv(c.env as any)
      const supabase = getSupabaseClient(c.env)

      const { data: merchant, error: mErr } = await supabase
        .from('merchants')
        .select('id, owner_id, store_name, phone')
        .eq('whatsapp_instance_name', instanceName)
        .maybeSingle()

      if (!merchant || mErr) {
        console.error(`[WhatsApp Webhook] Merchant not found for instance: ${instanceName}`)
        return
      }

      // Identify the sender number for logging and session lookups
      const senderNumber = isFromMe ? 
          merchant.phone?.replace(/\D/g, '') : 
          remoteJid.split('@')[0]

      // If it's 'fromMe', it's definitely the merchant talking from their linked phone.
      // Otherwise, check if the sender number matches the registered merchant phone.
      const isMerchantSender = isFromMe || (senderNumber === merchant.phone?.replace(/\D/g, ''))
      
      console.log(`[WhatsApp Webhook] isFromMe: ${isFromMe}, Sender: ${senderNumber}, Merchant Phone: ${merchant.phone}, isMerchant: ${isMerchantSender}`)
      
      let replyText = ''
      let sessionId = ''
      let supportSessionId: string | undefined

      try {
        if (isMerchantSender) {
          // --- MERCHANT MIND PATH ---
          const { data: session } = await supabase
            .from('agent_sessions')
            .select('id')
            .eq('merchant_id', merchant.owner_id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          sessionId = session?.id || ''
          if (!sessionId) {
            const { data: newSess, error: sErr } = await supabase.from('agent_sessions').insert({ 
              merchant_id: merchant.owner_id, 
              title: 'WhatsApp Merchant Chat',
              status: 'active'
            }).select('id').maybeSingle()
            
            if (sErr || !newSess) {
              console.error('[WhatsApp Webhook] Session Creation Error:', sErr)
              throw new Error(`Failed to create agent session: ${sErr?.message || 'unknown'}`)
            }
            sessionId = newSess.id
          }

          const res = await handleMerchantWhatsApp({
            senderPhone: senderNumber,
            messageText,
            merchantId: merchant.id,
            userId: merchant.owner_id,
            merchantName: merchant.store_name,
            sessionId
          })
          replyText = res.replyText

        } else {
          // --- CUSTOMER SUPPORT PATH ---
          const { data: sess } = await supabase
            .from('support_sessions')
            .select('id')
            .eq('merchant_id', merchant.id)
            .eq('customer_phone', senderNumber)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (sess) {
            supportSessionId = sess.id
          } else {
            supportSessionId = await createSupportSession(merchant.owner_id, undefined, `WhatsApp: ${senderNumber}`)
            await supabase.from('support_sessions').update({ customer_phone: senderNumber }).eq('id', supportSessionId)
          }

          const { data: config } = await supabase.from('support_configs').select('knowledge_base_text').eq('merchant_id', merchant.owner_id).maybeSingle()

          const res = await handleWhatsAppMessage({
            senderPhone: senderNumber,
            messageText,
            merchantId: merchant.id,
            ownerId: merchant.owner_id,
            merchantName: merchant.store_name,
            sessionId: supportSessionId!,
            knowledgeBase: config?.knowledge_base_text
          })
          replyText = res.replyText
          sessionId = supportSessionId!
        }
      } catch (agentErr: any) {
        console.error('[WhatsApp Webhook] Agent Logic Error:', agentErr)
        await supabase.from('whatsapp_messages').insert({
          merchant_id: merchant.id,
          session_id: sessionId || 'error-session',
          support_session_id: supportSessionId,
          recipient_number: conversationJid,
          sender_number: senderNumber,
          message_content: `[ERROR] AI processing failed: ${agentErr.message}`,
          direction: 'outbound',
          status: 'error'
        })
        throw agentErr // re-throw to be caught by main catch
      }

      // 2. Log Inbound
      await supabase.from('whatsapp_messages').insert({
        merchant_id: merchant.id,
        session_id: sessionId,
        support_session_id: supportSessionId,
        recipient_number: conversationJid,
        sender_number: senderNumber,
        message_content: messageText,
        direction: 'inbound',
        status: 'received'
      })

      // 3. Auto-Reply
      if (replyText) {
        const sendRes = await fetch(`${c.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: getHeaders(c.env),
          body: JSON.stringify({
            number: conversationJid,
            options: { delay: 1500, presence: 'composing' },
            text: replyText
          })
        })

        if (sendRes.ok) {
           const sendData = await sendRes.json() as any
           await supabase.from('whatsapp_messages').insert({
             merchant_id: merchant.id,
             session_id: sessionId,
             support_session_id: supportSessionId,
             recipient_number: conversationJid,
             message_content: replyText,
             direction: 'outbound',
             status: 'sent',
             evolution_message_id: sendData.key?.id || sendData.message?.key?.id
           })
        } else {
           const errorBody = await sendRes.text()
           console.error('[WhatsApp Webhook] Message Send Failed:', errorBody)
           await supabase.from('whatsapp_messages').insert({
             merchant_id: merchant.id,
             session_id: sessionId,
             support_session_id: supportSessionId,
             recipient_number: conversationJid,
             message_content: `[ERROR] Send Failed: ${errorBody}`,
             direction: 'outbound',
             status: 'error',
             sender_number: senderNumber
           })
        }
      }
    } catch (err) {
      console.error('[WhatsApp Webhook] Error:', err)
    }
  })())

  return c.json({ success: true })
})

export default whatsapp
