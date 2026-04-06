import {
  pgTable, uuid, text, numeric, timestamp, integer, jsonb, index,
} from "drizzle-orm/pg-core";

export const EXPENSE_CATEGORIES = [
  "utilities", "office_supplies", "rent_premises", "marketing_advertising",
  "professional_services", "software_subscriptions", "insurance",
  "repairs_maintenance", "postage_courier", "bank_charges", "staff_hr",
  "raw_materials_inventory", "transportation_vehicle", "meals_entertainment",
  "equipment_hardware", "other",
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
export type TaxDeductible   = "full" | "partial" | "none" | "capital_allowance";
export type ExpenseStatus   = "ai_review" | "confirmed" | "rejected";

export interface LineItem {
  description: string;
  quantity?:   number;
  unitPrice?:  number;
  amount:      number;
}

export const expenses = pgTable("expenses", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  merchantId:           uuid("merchant_id").notNull(),
  receiptUrl:           text("receipt_url").notNull(),
  receiptStoragePath:   text("receipt_storage_path").notNull(),
  vendorName:           text("vendor_name"),
  vendorAddress:        text("vendor_address"),
  receiptNumber:        text("receipt_number"),
  receiptDate:          timestamp("receipt_date", { withTimezone: true }),
  currency:             text("currency").notNull().default("MYR"),
  totalAmount:          numeric("total_amount",    { precision: 12, scale: 2 }),
  subtotalAmount:       numeric("subtotal_amount", { precision: 12, scale: 2 }),
  sstAmount:            numeric("sst_amount",      { precision: 12, scale: 2 }),
  paymentMethod:        text("payment_method"),
  lineItems:            jsonb("line_items").$type<LineItem[]>(),
  category:             text("category").$type<ExpenseCategory>().notNull().default("other"),
  categoryReason:       text("category_reason"),
  taxDeductible:        text("tax_deductible").$type<TaxDeductible>().notNull().default("full"),
  taxDeductiblePct:     integer("tax_deductible_pct").notNull().default(100),
  taxDeductibleReason:  text("tax_deductible_reason"),
  deductibleAmount:     numeric("deductible_amount", { precision: 12, scale: 2 }),
  status:               text("status").$type<ExpenseStatus>().notNull().default("ai_review"),
  aiConfidenceScore:    numeric("ai_confidence_score", { precision: 4, scale: 3 }),
  aiNotes:              text("ai_notes"),
  notes:                text("notes"),
  createdAt:            timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  merchantIdx: index("idx_expenses_merchant").on(t.merchantId),
  dateIdx:     index("idx_expenses_date").on(t.receiptDate),
  categoryIdx: index("idx_expenses_category").on(t.category),
}));
