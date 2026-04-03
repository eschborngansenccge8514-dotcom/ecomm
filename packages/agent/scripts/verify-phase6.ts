import { buildContextMessages } from '../src/memory/context-manager'
import { checkRateLimit } from '../src/middleware/rate-limiter'
import { AgentTracer } from '../src/observability/tracer'
import { withRetry } from '../src/middleware/executor'
import { createClient } from '@supabase/supabase-js'
try {
  require('dotenv').config()
} catch (e) {
  // dotenv not installed, skip
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found. DB tests will be skipped.')
}

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null

async function testContextManager() {
  if (!supabase) return true
  console.log('--- Testing Context Manager ---')
  const sessionId = 'test-session-' + Date.now()
  const merchantId = '00000000-0000-0000-0000-000000000000'
  
  // Create a session in DB first
  await (supabase as any).from('agent_sessions').insert({
    id: sessionId,
    merchant_id: merchantId,
    title: 'Test Session'
  })

  // Insert many messages to trigger pruning
  const manyMessages = Array.from({ length: 50 }, (_, i) => ({
    session_id: sessionId,
    merchant_id: merchantId,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: 'Message ' + i + ' '.repeat(500) // ~125 tokens per msg
  }))
  
  await (supabase as any).from('agent_messages').insert(manyMessages)

  const messages = await buildContextMessages(sessionId, merchantId, 'Final question')
  console.log(`Context built. Total messages: ${messages.length}`)
  console.log('First message summary:', messages[0].content.slice(0, 100))
  return messages.length < 50
}

async function testRateLimiter() {
  console.log('\n--- Testing Rate Limiter ---')
  const userId = 'user-rate-limit-test'
  
  for (let i = 0; i < 32; i++) {
    const limit = checkRateLimit(userId, 'chat')
    if (!limit.allowed) {
      console.log(`Blocked at request ${i+1}. Retry after: ${limit.retryAfterMs}ms`)
      return true
    }
  }
  return false
}

async function testTracer() {
  if (!supabase) return true
  console.log('\n--- Testing Tracer ---')
  const sessionId = 'test-session-' + Date.now()
  const merchantId = '00000000-0000-0000-0000-000000000000'
  const tracer = new AgentTracer(merchantId, sessionId, 'gemini-1.5-flash', 'chat')
  
  await tracer.flush({
    promptTokens: 1000,
    completionTokens: 500,
    steps: 2,
    status: 'completed'
  })
  
  const { data } = await (supabase as any)
    .from('agent_traces')
    .select('*')
    .eq('session_id', sessionId)
    .single()
    
  if (data) {
    console.log('Trace saved. Estimated cost:', data.estimated_cost_usd)
    return data.estimated_cost_usd > 0
  }
  return false
}

async function testResiliency() {
  console.log('\n--- Testing Resiliency ---')
  let attempts = 0
  const failingTask = async () => {
    attempts++
    if (attempts < 3) throw new Error('Simulated failure')
    return { success: true }
  }
  
  const result = await withRetry(failingTask, { maxRetries: 3, retryDelayMs: 100 })
  console.log(`Result after ${attempts} attempts:`, result)
  return result.success === true && attempts === 3
}

async function runAll() {
  const contextOk = await testContextManager().catch(e => { console.error(e); return false })
  const rateLimitOk = await testRateLimiter()
  const tracerOk = await testTracer().catch(e => { console.error(e); return false })
  const resiliencyOk = await testResiliency()
  
  console.log('\n--- Final Results ---')
  console.log(`Context Manager: ${contextOk ? '✅' : '❌'}`)
  console.log(`Rate Limiter:    ${rateLimitOk ? '✅' : '❌'}`)
  console.log(`Tracer:          ${tracerOk ? '✅' : '❌'}`)
  console.log(`Resiliency:      ${resiliencyOk ? '✅' : '❌'}`)
}

runAll()
