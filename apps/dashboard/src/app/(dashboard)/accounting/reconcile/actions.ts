'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

/**
 * AI OCR: Uses Gemini 2.0 Flash Lite to extract structured data from PDF/Images.
 */
export async function parseBankStatementWithAI(base64Data: string, mimeType: string) {
  try {
    const { object } = await generateObject({
      model: google('gemini-3.1-flash-lite-preview'),
      schema: z.object({
        transactions: z.array(z.object({
          date: z.string().describe('Transaction date in YYYY-MM-DD format'),
          description: z.string().describe('Clear description of the transaction'),
          amount: z.number().describe('Amount with decimals (+ for credit/inbound, - for debit/outbound)')
        }))
      }),
      system: 'You are an expert forensic accountant. Extract every single transaction from the provided bank statement document. Look for Date, Description/Payee, and Amount columns. Always return dates in YYYY-MM-DD format.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all transactions from this bank statement and return them as a list.'
            },
            {
              type: 'file',
              data: base64Data.split(',')[1],
              mediaType: mimeType
            }
          ]
        }
      ]
    })

    return object.transactions
  } catch (error: any) {
    console.error('Gemini OCR Error:', error)
    throw new Error(`AI Extraction Failed: ${error.message}`)
  }
}

/**
 * Bulk Auto-Match: Scans the entire feed and links high-confidence matches instantly.
 */
export async function bulkAutoMatch(bankAccountId: string) {
  const supabase = await createClient()
  
  // 1. Fetch all pending lines
  const { data: lines } = await supabase
    .from('bank_statement_lines')
    .select('*')
    .eq('bank_account_id', bankAccountId)
    .eq('status', 'pending')

  if (!lines || lines.length === 0) return { count: 0 }

  // 2. Fetch all unmatched journal entries for a broad date range
  const { data: entries } = await supabase
    .from('journal_entries')
    .select('*, coa_accounts(name)')
    // No status = 'matched' filter yet, so we just look for proximity
    .order('date', { ascending: false })
    .limit(500)

  let matchedCount = 0
  
  // 3. Perform deterministic matching (Amount + 7-day window)
  for (const line of lines) {
    const match = entries?.find(entry => {
      const amountMatch = Math.abs(entry.amount - Math.abs(line.amount)) < 0.01
      const dateDiff = Math.abs(new Date(entry.date).getTime() - new Date(line.transaction_date).getTime())
      const isClose = dateDiff < (7 * 24 * 60 * 60 * 1000)
      return amountMatch && isClose
    })

    if (match) {
      await supabase
        .from('bank_statement_lines')
        .update({ 
          status: 'matched', 
          matched_journal_entry_id: match.id 
        })
        .eq('id', line.id)
      matchedCount++
    }
  }

  revalidatePath('/accounting/reconcile')
  return { count: matchedCount }
}

export async function findPotentialMatches(amount: number, date: string) {
  const supabase = await createClient()

  // Search for journal entries with similar amount (±2%) within a 7-day window
  const dateObj = new Date(date)
  const startDate = new Date(dateObj)
  startDate.setDate(startDate.getDate() - 7)
  const endDate = new Date(dateObj)
  endDate.setDate(endDate.getDate() + 7)

  // We search for both exact and near matches
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('*, coa_accounts(name, code)')
    .gte('date', startDate.toISOString())
    .lte('date', endDate.toISOString())
    .order('date', { ascending: false })

  if (error) {
    console.error('Error finding matches:', error)
    return []
  }

  // Scoring logic (simulating what AI would do, but more deterministic for starters)
  // In a real prod environment, we could send the 'description' to OpenAI/Gemini
  return entries.filter(entry => {
    const amountMatch = Math.abs(entry.amount - Math.abs(amount)) < 0.01 // Exact 
    const nearMatch = Math.abs(entry.amount - Math.abs(amount)) / Math.abs(amount) < 0.05 // 5% diff
    return amountMatch || nearMatch
  }).map(entry => ({
    ...entry,
    confidence: Math.abs(entry.amount - Math.abs(amount)) < 0.01 ? 'High' : 'Medium'
  }))
}

export async function confirmMatch(lineId: string, journalEntryId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('bank_statement_lines')
    .update({
      status: 'matched',
      matched_journal_entry_id: journalEntryId
    })
    .eq('id', lineId)

  if (error) throw error

  revalidatePath('/accounting/reconcile')
  return { success: true }
}

export async function importBankStatement(bankAccountId: string, merchantId: string | undefined, lines: any[]) {
  const supabase = await createClient()

  // 1. Recover merchant context if missing from client
  let effectiveMerchantId = merchantId
  if (!effectiveMerchantId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Session expired. Please log in again.')
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('owner_id', user.id)
      .single()
    effectiveMerchantId = merchant?.id
  }

  if (!effectiveMerchantId) throw new Error('Merchant context lost. Please refresh.')

  let targetBankAccountId = bankAccountId

  // Auto-register if this is a COA account not yet in the banking table
  if (bankAccountId.startsWith('coa-')) {
    const coaId = bankAccountId.replace('coa-', '')

    // Fetch COA details first
    const { data: coa } = await supabase
      .from('coa_accounts')
      .select('name')
      .eq('id', coaId)
      .single()

    const { data: newBankAcc, error: createError } = await supabase
      .from('bank_accounts')
      .insert({
        merchant_id: effectiveMerchantId,
        coa_account_id: coaId,
        name: coa?.name || 'New Bank Account',
        is_active: true
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating bank account:', createError)
      throw new Error(`Failed to initialize banking table: ${createError.message}`)
    }
    targetBankAccountId = newBankAcc.id
  }

  const formattedLines = lines.map(line => ({
    bank_account_id: targetBankAccountId,
    merchant_id: effectiveMerchantId,
    transaction_date: line.date,
    description: line.description,
    amount: line.amount,
    debit: line.amount < 0 ? Math.abs(line.amount) : 0,
    credit: line.amount > 0 ? line.amount : 0,
    status: 'pending'
  }))

  const { data: createdLines, error } = await supabase
    .from('bank_statement_lines')
    .insert(formattedLines)
    .select()

  if (error) throw error

  revalidatePath('/accounting/reconcile')
  return { success: true, count: lines.length, data: createdLines || [] }
}

/**
 * Manual Posting: Creates a Journal Entry for a bank line and matches it immediately.
 */
export async function postManualReconcile(lineId: string, categoryCoaId: string) {
  const supabase = await createClient()

  // 1. Fetch the bank line details
  const { data: line, error: lineError } = await supabase
    .from('bank_statement_lines')
    .select('*, bank_accounts(coa_account_id)')
    .eq('id', lineId)
    .single()

  if (lineError || !line) throw new Error('Bank line not found')

  const bankCoaDetails = Array.isArray(line.bank_accounts) ? line.bank_accounts[0] : line.bank_accounts
  const bankCoaId = bankCoaDetails?.coa_account_id
  
  if (!bankCoaId) {
    console.error('Reconcile Error: Bank account coa_account_id not found', { 
      lineId, 
      bankDetails: line.bank_accounts 
    })
    throw new Error('Bank account not linked to Chart of Accounts (COA)')
  }

  // 1.5 Get current user for audit
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Authentication session lost. Please log in again.')

  // 1.6 Generate Entry Number (e.g., JE-2026-0001)
  const { count: entryCount, error: countError } = await supabase
    .from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', line.merchant_id)
  
  if (countError) {
    console.error('Count Error:', countError)
    throw new Error(`Failed to generate entry number: ${countError.message}`)
  }

  const entryNumber = `JE-${new Date().getFullYear()}-${((entryCount || 0) + 1).toString().padStart(4, '0')}`

  const description = `Reconcile: ${line.description}`

  // Create JE
  const { data: je, error: jeError } = await supabase
    .from('journal_entries')
    .insert({
      merchant_id: line.merchant_id,
      entry_number: entryNumber,
      date: line.transaction_date,
      description: description,
      source_type: 'BANK_RECONCILE',
      posted_by: user?.id,
      posted_at: new Date().toISOString()
    })
    .select()
    .single()

  if (jeError) {
    console.error('Journal Entry Error:', jeError)
    throw new Error(`JE Creation Failed: ${jeError.message} (${jeError.code})`)
  }

  if (!je) {
    console.error('Journal Entry not returned after insert')
    throw new Error('Failed to retrieve created Journal Entry. Check RLS policies.')
  }

  // Create Lines (Balanced)
  const lines = [
    // The "Bank Side"
    {
      journal_entry_id: je.id,
      account_id: bankCoaId,
      debit: line.amount > 0 ? line.amount : 0,
      credit: line.amount < 0 ? Math.abs(line.amount) : 0,
      description: description
    },
    // The "Category Side" (Offset)
    {
      journal_entry_id: je.id,
      account_id: categoryCoaId,
      debit: line.amount < 0 ? Math.abs(line.amount) : 0,
      credit: line.amount > 0 ? line.amount : 0,
      description: description
    }
  ]

  const { error: linesError } = await supabase
    .from('journal_lines')
    .insert(lines)

  if (linesError) {
    console.error('Journal Lines Error:', linesError)
    throw new Error(`Lines Posting Failed: ${linesError.message} (${linesError.code})`)
  }

  // 3. Mark line as matched
  await confirmMatch(lineId, je.id)

  revalidatePath('/accounting/reconcile')
  return { success: true }
}
