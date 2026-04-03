import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { buildTools } from '../../packages/agent/src/tools/index.ts'
import { buildSystemPrompt } from '../../packages/agent/src/prompts/system.ts'
import { getMerchantSnapshot } from '../../packages/agent/src/tools/automation.ts'

serve(async (req) => {
  const { run_type, merchant_id, playbook_id, context } = await req.json()
  const supabase = getSupabaseClient()

  // 1. Get merchant details
  const { data: merchant } = await supabase
    .from('merchants')
    .select('store_name')
    .eq('id', merchant_id)
    .single()

  if (!merchant) return new Response('Merchant not found', { status: 404 })

  // 2. Create a virtual session for this run
  const { data: session } = await supabase
    .from('agent_sessions')
    .insert({
      merchant_id,
      title: `Scheduled Run: ${run_type}`,
      is_active: false // Headless session
    })
    .select()
    .single()

  // 3. Log the start of the scheduled run
  const { data: runLog } = await supabase
    .from('agent_scheduled_runs')
    .insert({
      merchant_id,
      playbook_id,
      run_type,
      status: 'running'
    })
    .select()
    .single()

  try {
    // 4. Build custom system prompt for the headless agent
    const basePrompt = buildSystemPrompt(merchant.store_name)
    let agentInstructions = ""

    if (run_type === 'morning_briefing') {
      agentInstructions = `
        You are performing the morning business briefing.
        1. Call get_merchant_snapshot to see current state.
        2. Scan for any urgent issues (low stock, failed payments).
        3. Compare yesterday's performance with the same day last week.
        4. Push a summary alert to the dashboard with severity 'info'.
      `
    } else if (run_type === 'anomaly_scan') {
      agentInstructions = `
        Perform a deep anomaly scan.
        1. Call detect_anomalies for all categories with 'high' sensitivity.
        2. If any critical anomalies found, push_dashboard_alert with severity 'critical'.
        3. If no critical issues, just finish.
      `
    } else if (run_type === 'invoice_sweep') {
      agentInstructions = `
        Perform end-of-day invoice compliance check.
        1. Call list_pending_invoices.
        2. If any are older than 24h, push_dashboard_alert for manual submission.
        3. Do not submit automatically — high risk.
      `
    } else if (run_type === 'playbook' && playbook_id) {
      const { data: playbook } = await supabase
        .from('agent_playbooks')
        .select('*')
        .eq('id', playbook_id)
        .single()

      agentInstructions = `
        Execute Playbook: ${playbook.name}
        Steps:
        ${playbook.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}
        Contextual overrides: ${context || 'None'}
      `
    }

    // 5. Execute the agent loop (headless)
    const { text } = await generateText({
      model: google('gemini-3.1-flash-lite-preview'),
      system: basePrompt + "\n\n" + agentInstructions,
      prompt: "Start the background routine now.",
      tools: buildTools(merchant_id, session.id) as any,
      maxSteps: 10
    })

    // 6. Finalise log
    await supabase
      .from('agent_scheduled_runs')
      .update({
        status: 'completed',
        summary: text,
        completed_at: new Date().toISOString()
      })
      .eq('id', runLog.id)

    // 7. Update playbook if applicable
    if (playbook_id) {
      await supabase
        .from('agent_playbooks')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: 'success',
          last_run_summary: text
        })
        .eq('id', playbook_id)
    }

    return new Response(JSON.stringify({ success: true, summary: text }))
  } catch (err) {
    console.error(err)
    await supabase
      .from('agent_scheduled_runs')
      .update({
        status: 'failed',
        summary: `Error: ${String(err)}`,
        completed_at: new Date().toISOString()
      })
      .eq('id', runLog.id)

    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500 })
  }
})
