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
  taxDeductible: z.enum(["full", "partial", "none", "capital_allowance"]),
  taxDeductiblePct: z.number().int().min(0).max(100),
  taxDeductibleReason: z.string(),
  confidenceScore: z.number().min(0).max(1),
  aiNotes: z.string().optional(),
});

export type ReceiptExtraction = z.infer<typeof ReceiptExtractionSchema>;

export async function extractReceiptData(
  fileBuffer: ArrayBuffer,
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "application/pdf"
): Promise<ReceiptExtraction> {
  const base64Data = Buffer.from(fileBuffer).toString("base64");

  const { object } = await generateObject({
    model: google("gemini-2.5-flash-lite"),
    schema: ReceiptExtractionSchema,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: EXTRACTION_PROMPT },
        {
          type: "file",
          data: base64Data,
          mediaType: mimeType,
        },
      ],
    }],
  });

  return object;
}

const EXTRACTION_PROMPT = `
You are a certified Malaysian tax accountant reviewing a business receipt or invoice.

TASK 1 — EXTRACT all visible data: vendor name, address, receipt number, date,
subtotal, SST amount, grand total, payment method, and all line items.

TASK 2 — CATEGORISE into one of: utilities, office_supplies, rent_premises,
marketing_advertising, professional_services, software_subscriptions, insurance,
repairs_maintenance, postage_courier, bank_charges, staff_hr,
raw_materials_inventory, transportation_vehicle, meals_entertainment,
equipment_hardware, or other.

TASK 3 — TAX DEDUCTIBILITY under ITA 1967:
• full (100%): S33 ITA 1967 — wholly for business (utilities, rent, marketing, etc.)
• partial (50%): S39(1)(l) — entertainment limit (meals_entertainment)
• capital_allowance: Schedule 3 — equipment and hardware items
• none (0%): S39 — personal, fines, domestic

Set confidenceScore low (0.3–0.5) if fields are not clearly visible.
Currency defaults to MYR. Malaysia uses SST, not GST.
`.trim();
