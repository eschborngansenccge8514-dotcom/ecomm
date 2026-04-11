import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const QuotationItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  amount: z.number(),
});

export const QuotationExtractionSchema = z.object({
  vendorName: z.string(),
  vendorAddress: z.string().optional(),
  vendorEmail: z.string().email().optional(),
  vendorPhone: z.string().optional(),
  quotationNumber: z.string().optional(),
  date: z.string().optional(),           // YYYY-MM-DD
  currency: z.string().default("MYR"),
  totalAmount: z.number(),
  subtotalAmount: z.number().optional(),
  taxAmount: z.number().optional(),
  items: z.array(QuotationItemSchema),
  confidenceScore: z.number().min(0).max(1),
  notes: z.string().optional(),
});

export type QuotationExtraction = z.infer<typeof QuotationExtractionSchema>;

export async function extractQuotationData(
  fileBuffer: ArrayBuffer,
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "application/pdf",
  businessContext: string
): Promise<QuotationExtraction> {
  const base64Data = Buffer.from(fileBuffer).toString("base64");

  const { object } = await generateObject({
    model: google("gemini-3.1-flash-lite-preview"),
    schema: QuotationExtractionSchema,
    messages: [{
      role: "system",
      content: "You are an expert procurement assistant specializing in analyzing industrial and retail quotations. Your goal is to extract structured data precisely from quotation documents."
    }, {
      role: "user",
      content: [
        { type: "text", text: `BUSINESS CONTEXT: ${businessContext}\n\n${EXTRACTION_PROMPT}` },
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
TASK: Extract all relevant information from the attached quotation/proforma invoice.

1. Vendor Details: Extract the supplier's name, address, email, and phone number.
2. Quotation Info: Extract quotation number, date, and currency.
3. Items: Extract a list of all line items, their descriptions, quantities, unit prices, and total amounts.
4. Totals: Extract subtotal, tax/SST amount, and grand total.

Set confidenceScore based on how clear the document is.
Return the date in YYYY-MM-DD format.
`.trim();
