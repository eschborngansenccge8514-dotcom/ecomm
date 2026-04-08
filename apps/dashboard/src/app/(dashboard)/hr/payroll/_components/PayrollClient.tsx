"use client";

import { useState, useTransition } from "react";
import { generatePayrollRun, finalizePayrollRun, getPayrollItems } from "../../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, Play, Lock, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

type PayrollRun = Record<string, unknown>;
type PayrollItem = Record<string, unknown>;

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const now = new Date();
const YEARS = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

function rm(v: unknown) {
  return `RM ${Number(v).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: unknown }) {
  if (status === "finalized") return <Badge className="bg-emerald-100 text-emerald-700 border-0">Finalized</Badge>;
  if (status === "paid") return <Badge className="bg-blue-100 text-blue-700 border-0">Paid</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-0">Draft</Badge>;
}

export function PayrollClient({ runs: initialRuns }: { runs: PayrollRun[] }) {
  const [runs, setRuns] = useState(initialRuns);
  const [genYear, setGenYear] = useState(String(now.getFullYear()));
  const [genMonth, setGenMonth] = useState(String(now.getMonth() + 1));
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [itemsMap, setItemsMap] = useState<Record<string, PayrollItem[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      try {
        const result = await generatePayrollRun(parseInt(genYear), parseInt(genMonth));
        toast.success(`Payroll generated for ${MONTHS[parseInt(genMonth) - 1]} ${genYear} (${result.itemCount} employees)`);
        // Reload by refreshing — update locally
        window.location.reload();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to generate payroll");
      }
    });
  }

  async function handleExpand(run: PayrollRun) {
    const id = String(run.id);
    if (expandedRunId === id) { setExpandedRunId(null); return; }
    setExpandedRunId(id);
    if (!itemsMap[id]) {
      const items = await getPayrollItems(id);
      setItemsMap((prev) => ({ ...prev, [id]: items as PayrollItem[] }));
    }
  }

  function handleFinalize(runId: string) {
    if (!confirm("Finalize this payroll run? It cannot be re-generated after finalization.")) return;
    startTransition(async () => {
      try {
        await finalizePayrollRun(runId);
        setRuns((prev) => prev.map((r) => r.id === runId ? { ...r, status: "finalized" } : r));
        toast.success("Payroll finalized");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Generator */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-4">Generate Payroll Run</h2>
        <div className="flex items-end gap-4">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium">Year</p>
            <Select value={genYear} onValueChange={(v) => setGenYear(v || '')}>
              <SelectTrigger className="w-32 rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium">Month</p>
            <Select value={genMonth} onValueChange={(v) => setGenMonth(v || '')}>
              <SelectTrigger className="w-40 rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isPending}
            className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
          >
            <Play size={14} /> {isPending ? "Generating..." : "Generate"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-gray-400 flex items-center gap-1.5">
          <AlertCircle size={12} />
          Calculations use EPF Act 1991, SOCSO 1st/2nd Schedule, EIS Act 2017, and LHDN PCB formula method.
        </p>
      </div>

      {/* Payroll Runs List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Payroll History</h2>
        </div>

        {runs.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            No payroll runs yet. Generate your first payroll above.
          </div>
        )}

        {runs.map((run) => {
          const expanded = expandedRunId === String(run.id);
          const items = itemsMap[String(run.id)] ?? [];

          return (
            <div key={String(run.id)} className="border-b border-gray-100 last:border-0">
              {/* Run header */}
              <div
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleExpand(run)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-bold text-gray-900">
                      {MONTHS[Number(run.period_month) - 1]} {String(run.period_year)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Gross: {rm(run.total_gross)} · Net: {rm(run.total_net)}
                    </p>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
                <div className="flex items-center gap-3">
                  {run.status === "draft" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-8 gap-1 text-xs"
                      onClick={(e) => { e.stopPropagation(); handleFinalize(String(run.id)); }}
                      disabled={isPending}
                    >
                      <Lock size={12} /> Finalize
                    </Button>
                  )}
                  {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>

              {/* Expanded: summary row + per-employee items */}
              {expanded && (
                <div className="border-t border-gray-100">
                  {/* Statutory summary */}
                  <div className="px-5 py-4 bg-gray-50 grid grid-cols-5 gap-4 text-xs">
                    {[
                      ["Total Gross", rm(run.total_gross)],
                      ["EPF (Employee)", rm(run.total_epf_ee)],
                      ["EPF (Employer)", rm(run.total_epf_er)],
                      ["SOCSO + EIS (EE)", `${rm(Number(run.total_socso_ee) + Number(run.total_eis_ee))}`],
                      ["PCB/MTD", rm(run.total_pcb)],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <p className="text-gray-400 font-medium mb-0.5">{label}</p>
                        <p className="font-bold text-gray-800">{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Per-employee table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wide">
                          <th className="text-left px-5 py-2 font-semibold">Employee</th>
                          <th className="text-right px-3 py-2 font-semibold">Days</th>
                          <th className="text-right px-3 py-2 font-semibold">Basic</th>
                          <th className="text-right px-3 py-2 font-semibold">OT Pay</th>
                          <th className="text-right px-3 py-2 font-semibold">Gross</th>
                          <th className="text-right px-3 py-2 font-semibold">EPF (EE)</th>
                          <th className="text-right px-3 py-2 font-semibold">EPF (ER)</th>
                          <th className="text-right px-3 py-2 font-semibold">SOCSO</th>
                          <th className="text-right px-3 py-2 font-semibold">EIS</th>
                          <th className="text-right px-3 py-2 font-semibold">PCB</th>
                          <th className="text-right px-5 py-2 font-semibold">Net Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const emp = (item.employees as Record<string, unknown>) ?? {};
                          return (
                            <tr key={String(item.id)} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="px-5 py-2.5">
                                <p className="font-semibold text-gray-900">{String(emp.full_name ?? "—")}</p>
                                <p className="text-gray-400">{String(emp.job_title ?? "")}</p>
                              </td>
                              <td className="px-3 py-2.5 text-right text-gray-600">{Number(item.work_days)}</td>
                              <td className="px-3 py-2.5 text-right font-mono">{rm(item.basic_salary)}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-amber-700">{Number(item.overtime_pay) > 0 ? rm(item.overtime_pay) : "—"}</td>
                              <td className="px-3 py-2.5 text-right font-mono font-semibold">{rm(item.gross_salary)}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-red-600">({rm(item.epf_employee)})</td>
                              <td className="px-3 py-2.5 text-right font-mono text-orange-600">{rm(item.epf_employer)}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-red-500">({rm(Number(item.socso_employee) + Number(item.socso_employer))})</td>
                              <td className="px-3 py-2.5 text-right font-mono text-red-400">({rm(Number(item.eis_employee) + Number(item.eis_employer))})</td>
                              <td className="px-3 py-2.5 text-right font-mono text-red-600">({rm(item.pcb)})</td>
                              <td className="px-5 py-2.5 text-right font-mono font-black text-emerald-700">{rm(item.net_salary)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Legal note */}
                  <div className="px-5 py-3 bg-blue-50 text-xs text-blue-600">
                    EPF: Act 1991 3rd Schedule · SOCSO: Perkeso 1st/2nd Schedule · EIS: Act 2017 (0.2% each, cap RM4k) · PCB: LHDN formula method (simplified). Consult a licensed payroll agent for submission.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
