import { createLalamoveBooking } from './packages/agent/src/tools/logistics'
import * as dotenv from 'dotenv'
import path from 'path'

// Load apps/dashboard/.env.local for Supabase credentials
dotenv.config({ path: path.resolve(process.cwd(), 'apps/dashboard/.env.local') })

const MERCHANT_ID = 'c232d615-45ab-4b1e-b470-c56643fd80f4'
const SESSION_ID  = 'test-session-' + Date.now()
const ORDER_ID    = '40c5644c-c064-4192-b685-97ab58f7db0f' // ORD-2026-01063

async function runTest() {
  console.log('--- Triggering Guarded Lalamove Booking ---')
  console.log(`Merchant: ${MERCHANT_ID}`)
  console.log(`Order: ${ORDER_ID}`)

  const tool = createLalamoveBooking(MERCHANT_ID, SESSION_ID)
  
  try {
    const result = await (tool as any).execute({
      order_id: ORDER_ID,
      service_type: 'MOTORCYCLE'
    })

    console.log('\nResult from executeWithGuard:')
    console.log(JSON.stringify(result, null, 2))

    if (result.status === 'requires_approval') {
      console.log('\nSUCCESS: Action correctly intercepted and queued for approval.')
      console.log(`Approval ID: ${result.approval_id}`)
    } else {
      console.log('\nFAILURE: Action was not intercepted.')
    }
  } catch (error) {
    console.error('\nERROR during execution:', error)
  }
}

runTest()
