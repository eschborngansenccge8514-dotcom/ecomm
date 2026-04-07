import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard } from '../middleware/executor'
import { createClient } from '@supabase/supabase-js'

const recordExpenseParams = z.object({

  vendorName: z.string().describe('Name of the vendor or supplier'),
  vendorAddress: z.string().optional().describe('Address of the vendor if available'),
  receiptNumber: z.string().optional().describe('Invoice or receipt number'),
  receiptDate: z.string().describe('Date of the receipt in YYYY-MM-DD format'),
  totalAmount: z.number().describe('Grand total amount of the expense'),
  subtotalAmount: z.number().optional().describe('Amount before tax'),
  sstAmount: z.number().optional().describe('Sales and Services Tax amount if any'),
  currency: z.string().default('MYR').describe('Currency code (e.g. MYR, USD)'),
  paymentMethod: z.string().optional().describe('How the expense was paid (e.g. credit card, cash, bank transfer)'),
  category: z.enum([
    "utilities", "office_supplies", "rent_premises", "marketing_advertising",
    "professional_services", "software_subscriptions", "insurance",
    "repairs_maintenance", "postage_courier", "bank_charges", "staff_hr",
    "raw_materials_inventory", "transportation_vehicle", "meals_entertainment",
    "equipment_hardware", "other"
  ]).describe('Categorisation of the expense'),
  categoryReason: z.string().describe('Reasoning for choosing this category'),
  taxDeductible: z.enum(["full", "partial", "none", "capital_allowance"]).describe('The tax deductibility under ITA 1967'),
  taxDeductiblePct: z.number().int().describe('Percentage of the expense that is explicitly tax deductible (0 to 100)'),
  taxDeductibleReason: z.string().describe('Reasoning for the tax deductibility'),
  confidenceScore: z.number().min(0).max(1).describe('AI confidence score for the extraction (0 to 1)'),
  aiNotes: z.string().optional().describe('Any specific notes or warnings about the extraction'),
  notes: z.string().optional().describe('User provided notes or additional description'),
  receiptUrl: z.string().optional().describe('URL of the receipt image if applicable'),
  receiptStoragePath: z.string().optional().describe('Storage path in Supabase if applicable')
})

export const recordExpense = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Record an expense or receipt into the system. Use this whenever the merchant uploads an image or explicitly asks to record an expense.',
    parameters: recordExpenseParams,
    execute: (input: any) =>
      executeWithGuard('record_expense', input, { 
        riskLevel: 'low',
        approvalTitle: (i: any) => `Record Expense: ${i.vendorName} (RM${i.totalAmount})`,
        approvalDescription: (i: any) => `Create a new expense record for ${i.vendorName} on ${i.receiptDate} for RM${i.totalAmount} in category ${i.category}.`
      }, merchantId, sessionId,
      async () => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const total = Number(input.totalAmount);
        const pct = Number(input.taxDeductiblePct || 100);
        const deductibleAmt = total * (pct / 100);

        const { data, error } = await supabase
          .from("expenses")
          .insert({
            merchant_id: merchantId,
            receipt_url: input.receiptUrl,
            receipt_storage_path: input.receiptStoragePath,
            vendor_name: input.vendorName,
            vendor_address: input.vendorAddress,
            receipt_number: input.receiptNumber,
            receipt_date: input.receiptDate,
            currency: input.currency || "MYR",
            total_amount: total,
            subtotal_amount: input.subtotalAmount ? Number(input.subtotalAmount) : null,
            sst_amount: input.sstAmount ? Number(input.sstAmount) : null,
            payment_method: input.paymentMethod,
            category: input.category,
            category_reason: input.categoryReason,
            tax_deductible: input.taxDeductible,
            tax_deductible_pct: pct,
            tax_deductible_reason: input.taxDeductibleReason,
            deductible_amount: deductibleAmt,
            status: "confirmed",
            ai_confidence_score: input.confidenceScore,
            ai_notes: input.aiNotes,
            notes: input.notes,
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to record expense: ${error.message}`);
        }

        return data;
      })
  } as any)

export const listExpenses = (merchantId: string, sessionId: string) =>
  tool({
    description: 'List recorded business expenses with optional filtering by category or date range.',
    parameters: z.object({
      category: z.string().optional().describe('Filter by expense category'),
      startDate: z.string().optional().describe('Filter by receipt date from (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('Filter by receipt date to (YYYY-MM-DD)'),
      limit: z.number().default(20).describe('Number of records to return'),
      offset: z.number().default(0).describe('Pagination offset')
    }),
    execute: (input: any) =>
      executeWithGuard('list_expenses', input, { riskLevel: 'low' }, merchantId, sessionId,
      async () => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        let query = supabase
          .from("expenses")
          .select("*", { count: 'exact' })
          .eq("merchant_id", merchantId)
          .order("receipt_date", { ascending: false })
          .range(input.offset, input.offset + input.limit - 1);

        if (input.category) {
          query = query.eq("category", input.category);
        }
        if (input.startDate) {
          query = query.gte("receipt_date", input.startDate);
        }
        if (input.endDate) {
          query = query.lte("receipt_date", input.endDate);
        }

        const { data, error, count } = await query;
        if (error) throw new Error(`Failed to list expenses: ${error.message}`);
        return {
          expenses: data,
          pagination: {
            total: count,
            offset: input.offset,
            limit: input.limit
          }
        };
      })
  } as any)


export const getExpenseDetails = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get full details of a specific expense by its ID.',
    parameters: z.object({
      id: z.string().describe('The unique UUID of the expense')
    }),
    execute: (input: any) =>
      executeWithGuard('get_expense_details', input, { riskLevel: 'low' }, merchantId, sessionId,
      async () => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data, error } = await supabase
          .from("expenses")
          .select("*")
          .eq("merchant_id", merchantId)
          .eq("id", input.id)
          .single();

        if (error) throw new Error(`Failed to get expense details: ${error.message}`);
        return data;
      })
  } as any)


