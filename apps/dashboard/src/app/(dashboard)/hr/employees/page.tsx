import { getAuthContext } from "@/lib/utils.server";
import { getEmployees } from "../actions";
import { EmployeesClient } from "./_components/EmployeesClient";
import { Users, UserPlus } from "lucide-react";

export default async function EmployeesPage() {
  await getAuthContext();
  const employees = await getEmployees();

  const active = employees.filter((e) => e.status === "active").length;
  const fullTime = employees.filter((e) => e.employment_type === "full_time").length;
  const partTime = employees.filter((e) => e.employment_type !== "full_time").length;

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Employees</h1>
          <p className="text-gray-500 font-medium mt-1">Manage staff records and employment details</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Active</p>
              <p className="text-2xl font-black text-gray-900">{active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <UserPlus size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Full-time</p>
              <p className="text-2xl font-black text-gray-900">{fullTime}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Users size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Part-time / Contract</p>
              <p className="text-2xl font-black text-gray-900">{partTime}</p>
            </div>
          </div>
        </div>
      </div>

      <EmployeesClient employees={employees} />
    </div>
  );
}
