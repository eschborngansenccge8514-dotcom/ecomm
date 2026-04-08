import { getAuthContext } from "@/lib/utils.server";
import { getPayrollRuns } from "../actions";
import { PayrollClient } from "./_components/PayrollClient";
import { DollarSign, FileText, Users, TrendingUp } from "lucide-react";

export default async function PayrollPage() {
  await getAuthContext();
  const runs = await getPayrollRuns();

  const latestFinalized = runs.find((r) => r.status === "finalized");
  const totalNetLatest = latestFinalized ? Number(latestFinalized.total_net) : 0;
  const totalGrossLatest = latestFinalized ? Number(latestFinalized.total_gross) : 0;
  const totalEpfErLatest = latestFinalized ? Number(latestFinalized.total_epf_er) : 0;

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Payroll</h1>
        <p className="text-gray-500 font-medium mt-1">
          Generate monthly payroll with EPF, SOCSO, EIS & PCB (Malaysia Employment Act 1955)
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-5">
        {[
          {
            label: "Latest Net Payroll",
            value: `RM ${totalNetLatest.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`,
            icon: <DollarSign size={18} />,
            color: "emerald",
          },
          {
            label: "Latest Gross Payroll",
            value: `RM ${totalGrossLatest.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`,
            icon: <TrendingUp size={18} />,
            color: "blue",
          },
          {
            label: "Employer EPF Contribution",
            value: `RM ${totalEpfErLatest.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`,
            icon: <Users size={18} />,
            color: "purple",
          },
          {
            label: "Total Payroll Runs",
            value: runs.length,
            icon: <FileText size={18} />,
            color: "gray",
          },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-${color}-50 flex items-center justify-center text-${color}-600`}>
                {icon}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-lg font-black text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <PayrollClient runs={runs} />
    </div>
  );
}
