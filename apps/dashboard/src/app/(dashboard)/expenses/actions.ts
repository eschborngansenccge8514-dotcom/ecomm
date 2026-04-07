"use server";

import { getAuthContext } from "@/lib/utils.server";
import { extractReceiptData } from "@project1/agent";
import { revalidatePath } from "next/cache";

export async function analyseReceipt(storagePath: string, mimeType: any) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) throw new Error("Unauthorized");

  // 1. Download file from Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("receipts")
    .download(storagePath);

  if (downloadError || !fileData) {
    console.error("Download error:", downloadError);
    throw new Error("Failed to download receipt from storage");
  }

  // 2. Extract data via AI
  const buffer = await fileData.arrayBuffer();
  const extraction = await extractReceiptData(buffer, mimeType);

  // 3. Get temporary URL for preview
  const { data: urlData } = await supabase.storage
    .from("receipts")
    .createSignedUrl(storagePath, 3600);

  return {
    extraction,
    receiptUrl: urlData?.signedUrl,
  };
}

export async function saveExpense(input: any) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) throw new Error("Unauthorized");

  const total = Number(input.totalAmount);
  const pct   = Number(input.taxDeductiblePct || 100);
  const deductibleAmt = total * (pct / 100);

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      merchant_id:           merchant.id,
      receipt_url:           input.receiptUrl,
      receipt_storage_path:  input.receiptStoragePath,
      vendor_name:           input.vendorName,
      vendor_address:        input.vendorAddress,
      receipt_number:        input.receiptNumber,
      receipt_date:          input.receiptDate,
      currency:              input.currency || "MYR",
      total_amount:          total,
      subtotal_amount:       input.subtotalAmount ? Number(input.subtotalAmount) : null,
      sst_amount:            input.sstAmount ? Number(input.sstAmount) : null,
      payment_method:        input.paymentMethod,
      line_items:            input.lineItems,
      category:              input.category,
      category_reason:       input.categoryReason,
      tax_deductible:        input.taxDeductible,
      tax_deductible_pct:    pct,
      tax_deductible_reason: input.taxDeductibleReason,
      deductible_amount:     deductibleAmt,
      status:                input.status || "confirmed",
      ai_confidence_score:   input.confidenceScore,
      ai_notes:              input.aiNotes,
      notes:                 input.notes,
    })
    .select()
    .single();

  if (error) {
    console.error("Save expense error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/expenses");
  return data;
}

export async function getExpenses(filters?: { 
  category?: string; 
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) return { data: [], totalCount: 0 };

  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("expenses")
    .select("*", { count: "exact" })
    .eq("merchant_id", merchant.id)
    .order("receipt_date", { ascending: false });

  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }

  if (filters?.search) {
    query = query.ilike("vendor_name", `%${filters.search}%`);
  }

  if (filters?.startDate) {
    query = query.gte("receipt_date", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("receipt_date", filters.endDate);
  }

  const { data, error, count } = await query.range(from, to);
  
  if (error) {
    console.error("Get expenses error:", error.message || error);
    return { data: [], totalCount: 0 };
  }

  return { data: data || [], totalCount: count || 0 };
}

export async function getExpenseSummary(year?: number) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) return null;

  const currentYear = year || new Date().getFullYear();
  const startDate = `${currentYear}-01-01`;
  const endDate   = `${currentYear}-12-31`;

  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("total_amount, deductible_amount, sst_amount, category")
    .eq("merchant_id", merchant.id)
    .gte("receipt_date", startDate)
    .lte("receipt_date", endDate);

  if (error) {
    console.error("Get expense summary error:", error.message || error);
    return null;
  }

  const totalSpent      = expenses.reduce((sum, e) => sum + Number(e.total_amount || 0), 0);
  const totalDeductible = expenses.reduce((sum, e) => sum + Number(e.deductible_amount || 0), 0);
  const totalSst        = expenses.reduce((sum, e) => sum + Number(e.sst_amount || 0), 0);
  const estTaxSavings   = totalDeductible * 0.17; // 17% SME rate

  const categoryMap: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.total_amount || 0);
  });

  const categories = Object.entries(categoryMap).map(([name, value]) => ({
    name,
    value,
    percentage: (value / totalSpent) * 100,
  })).sort((a, b) => b.value - a.value);

  return {
    totalSpent,
    totalDeductible,
    totalSst,
    estTaxSavings,
    categories,
  };
}

export async function getExpenseById(id: string) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) return null;

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .single();

  if (error) return null;
  return data;
}

export async function updateExpense(id: string, updates: any) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) throw new Error("Unauthorized");

  const total = updates.totalAmount ? Number(updates.totalAmount) : undefined;
  const pct   = updates.taxDeductiblePct ? Number(updates.taxDeductiblePct) : undefined;
  
  let deductibleAmt;
  if (total !== undefined && pct !== undefined) {
    deductibleAmt = total * (pct / 100);
  }

  const { error } = await supabase
    .from("expenses")
    .update({
      ...updates,
      deductible_amount: deductibleAmt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("merchant_id", merchant.id);

  if (error) throw new Error(error.message);

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
}

export async function deleteExpense(id: string) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) throw new Error("Unauthorized");

  // 1. Get storage path first
  const { data: expense } = await supabase
    .from("expenses")
    .select("receipt_storage_path")
    .eq("id", id)
    .single();

  if (expense?.receipt_storage_path) {
    // 2. Delete from storage
    await supabase.storage.from("receipts").remove([expense.receipt_storage_path]);
  }

  // 3. Delete from DB
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("merchant_id", merchant.id);

  if (error) throw new Error(error.message);

  revalidatePath("/expenses");
}

export async function exportExpensesCsv(filters?: { category?: string; search?: string; startDate?: string; endDate?: string }) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) throw new Error("Unauthorized");

  let query = supabase
    .from("expenses")
    .select("receipt_date, vendor_name, category, total_amount, sst_amount, deductible_amount, payment_method, notes")
    .eq("merchant_id", merchant.id)
    .order("receipt_date", { ascending: false });

  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }

  if (filters?.search) {
    query = query.ilike("vendor_name", `%${filters.search}%`);
  }

  if (filters?.startDate) {
    query = query.gte("receipt_date", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("receipt_date", filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  if (!data || data.length === 0) return "";

  const headers = ["Date", "Vendor", "Category", "Total Amount", "SST Amount", "Deductible Amount", "Payment Method", "Notes"];
  const rows = data.map(e => [
    e.receipt_date ? new Date(e.receipt_date).toLocaleDateString() : "",
    e.vendor_name || "",
    e.category || "",
    e.total_amount || 0,
    e.sst_amount || 0,
    e.deductible_amount || 0,
    e.payment_method || "",
    e.notes || ""
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  return csvContent;
}
