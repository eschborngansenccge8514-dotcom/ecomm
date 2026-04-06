import { getAuthContext } from "@/lib/utils.server";
import { getExpenseById } from "../actions";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, User, Tag, Receipt, Info, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { EditExpenseForm } from "./EditExpenseForm";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  const { merchant } = await getAuthContext();
  const expense = await getExpenseById(id);

  if (!expense) notFound();

  const details = [
    { label: 'Vendor', value: expense.vendor_name, icon: <User size={16} /> },
    { label: 'Date', value: expense.receipt_date ? new Date(expense.receipt_date).toLocaleDateString() : 'N/A', icon: <Calendar size={16} /> },
    { label: 'Category', value: expense.category.replace(/_/g, ' '), icon: <Tag size={16} />, badge: true },
    { label: 'Total Amount', value: `RM ${Number(expense.total_amount).toFixed(2)}`, icon: <Receipt size={16} />, bold: true },
  ];

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      <Link href="/expenses" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors">
        <ArrowLeft size={16} /> Back to Expenses
      </Link>

      <div className="flex flex-col lg:flex-row gap-10 items-start">
        {/* Receipt Visual */}
        <div className="w-full lg:w-1/2 space-y-6">
           <div className="flex items-center justify-between">
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Receipt View</h1>
              <Badge variant="outline" className="rounded-xl border-gray-100 bg-gray-50 text-gray-400 font-bold px-3">
                ID: {expense.id.slice(0, 8)}
              </Badge>
           </div>
           
           <Card className="rounded-[40px] border-gray-100 shadow-xl overflow-hidden bg-gray-50 aspect-[3/4] relative group">
              <img src={expense.receipt_url} alt="Receipt" className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-8">
                <Link href={expense.receipt_url} target="_blank" className="p-4 bg-white rounded-full shadow-2xl text-gray-900 font-bold flex items-center gap-2 hover:scale-110 transition-all">
                   Open Original <ArrowLeft className="rotate-135" size={16} />
                </Link>
              </div>
           </Card>
        </div>

        {/* Data & Editing */}
        <div className="w-full lg:w-1/2 space-y-8">
           <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                 <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
                 Extraction Data
              </h2>
              <p className="text-gray-400 font-medium">Verify or edit the extracted details below</p>
           </div>

           <div className="grid grid-cols-2 gap-4">
              {details.map((d) => (
                <div key={d.label} className="p-4 bg-white rounded-3xl border border-gray-50 shadow-sm space-y-1">
                   <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {d.icon} {d.label}
                   </div>
                   {d.badge ? (
                     <Badge variant="outline" className="rounded-lg bg-gray-50 border-gray-100 text-gray-600 font-bold">
                        {d.value}
                     </Badge>
                   ) : (
                     <p className={cn("text-lg font-black text-gray-900 truncate", d.bold && "text-blue-600")}>
                        {d.value}
                     </p>
                   )}
                </div>
              ))}
           </div>

           <div className="p-6 bg-blue-50/50 rounded-[32px] border border-blue-100/50 space-y-4">
              <div className="flex items-center justify-between">
                 <h4 className="font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Info size={16} className="text-blue-500" />
                    Tax AI Reasoning
                 </h4>
                 <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <p className="text-sm text-blue-900/70 font-medium leading-relaxed italic">
                "{expense.tax_deductible_reason || 'AI identified this as a legitimate business expense based on vendor category and item details.'}"
              </p>
           </div>

           <EditExpenseForm expense={expense} />
        </div>
      </div>
    </div>
  );
}
