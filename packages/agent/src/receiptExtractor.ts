import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  amount: z.number(),
});

export const ReceiptExtractionSchema = z.object({
  vendorName: z.string(),
  vendorAddress: z.string().optional(),
  receiptNumber: z.string().optional(),
  receiptDate: z.string(),           // YYYY-MM-DD
  currency: z.string().default("MYR"),
  totalAmount: z.number(),
  subtotalAmount: z.number().optional(),
  sstAmount: z.number().optional(),
  sstType: z.enum(["0%", "6%", "8%", "10%", "exempt"]).optional(),
  paymentMethod: z.string().optional(),
  lineItems: z.array(LineItemSchema).optional(),
  category: z.enum([
    "utilities", "office_supplies", "rent_premises", "marketing_advertising",
    "professional_services", "software_subscriptions", "insurance",
    "repairs_maintenance", "postage_courier", "bank_charges", "staff_hr",
    "raw_materials_inventory", "transportation_vehicle", "meals_entertainment",
    "equipment_hardware", "other",
  ]),
  categoryReason: z.string(),
  suggestedDebitAccount: z.string().describe("Likely name of the expense account from COA"),
  suggestedCreditAccount: z.string().describe("Likely name of the payment account (e.g. Cash, Bank, CC)"),
  taxDeductible: z.enum(["full", "partial", "none", "capital_allowance"]),
  taxDeductiblePct: z.number().int().min(0).max(100),
  taxDeductibleReason: z.string(),
  confidenceScore: z.number().min(0).max(1),
  aiNotes: z.string().optional().describe("Note specific ITA 1967 section if relevant (e.g. S33(1))"),
});

export type ReceiptExtraction = z.infer<typeof ReceiptExtractionSchema>;

export async function extractReceiptData(
  fileBuffer: ArrayBuffer,
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "application/pdf",
  businessContext: string
): Promise<ReceiptExtraction> {
  const base64Data = Buffer.from(fileBuffer).toString("base64");

  const { object } = await generateObject({
    model: google("gemini-3.1-flash-lite-preview"), // Using 2.0 Flash Lite for high speed/low cost
    schema: ReceiptExtractionSchema,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: `BUSINESS CONTEXT: ${businessContext}\n\n${EXTRACTION_PROMPT}` },
        {
          type: "image",
          image: base64Data,
        },
      ],
    }],
  });

  return object;
}

const EXTRACTION_PROMPT = `
You are a certified Malaysian tax accountant and auditor.

TASK 1 — DATA EXTRACTION: Extract vendor, address, date, subtotal, sstAmount (6%, 8%, 10%), total, and items.

TASK 2 — ACCOUNTING MAPPING: Suggest 'suggestedDebitAccount' and 'suggestedCreditAccount'.
- Common Debits: Electricity & Water, Office Supplies, Rent, Staff Salaries, Marketing, Legal & Professional.
- Common Credits: Cash in Hand, Bank Account, Credit Card Payable.

TASK 3 — ITA 1967 AUDIT: 
- Determine taxDeductible (full/partial/none/capital_allowance).
- Citations: Refer to S33(1) for wholly/exclusively expenses. Refer to S39(1)(l) for entertainment restriction (50%).
- Capital Allowance (CA): If it's a fixed asset (laptop, machinery), set to 'capital_allowance'.

TASK 4 — SST ANALYSIS: 
Identify SST rate. In Malaysia, services are typically 6% or 8% (effective Mar 2024), and goods are 5% or 10%.

Confidence: Set low (<0.5) if blurred or handwritten.
Currency: Default MYR.
`.trim();
