import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const BankTransactionSchema = z.object({
  date: z.string().describe("ISO date of transaction"),
  description: z.string().describe("Full transaction description/memo"),
  reference: z.string().optional().describe("Check no or transaction ref"),
  amount: z.number().describe("Total amount (+ for credit/in, - for debit/out)"),
  suggestedAccount: z.string().optional().describe("Suggested COA account name (e.g. Utilities, Sales, Salary)"),
  confidence: z.number().min(0).max(1)
});

const BankStatementSchema = z.object({
  bankName: z.string(),
  periodFrom: z.string(),
  periodTo: z.string(),
  openingBalance: z.number(),
  closingBalance: z.number(),
  transactions: z.array(BankTransactionSchema)
});

export type BankStatement = z.infer<typeof BankStatementSchema>;

export class BankStatementExtractor {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async extract(text: string): Promise<BankStatement> {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an expert Accountant. Extract bank statement data from the following raw text.
      Return the data strictly in JSON format matching the provided schema.
      Rules:
      1. Dates must be ISO 8601 format (YYYY-MM-DD).
      2. If a transaction is a DEBIT (money out), the amount must be NEGATIVE.
      3. If a transaction is a CREDIT (money in), the amount must be POSITIVE.
      4. Suggest the most likely Chart of Accounts category based on the description.

      TEXT:
      ${text}
    `;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text()) as BankStatement;
  }
}
