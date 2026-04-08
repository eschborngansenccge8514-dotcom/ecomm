import { getAuthContext } from "@/lib/utils.server";
import { getEmployees, getTodayAttendance, getAttendanceForPeriod } from "../actions";
import { AttendanceClient } from "./_components/AttendanceClient";
import { Clock, UserCheck, UserX, Timer } from "lucide-react";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
  await getAuthContext();
  const { startDate, endDate } = await searchParams;

  const today = new Date().toISOString().split("T")[0];
  const rangeStart = startDate ?? today;
  const rangeEnd = endDate ?? today;

  const [employees, todayRecords, rangeRecords] = await Promise.all([
    getEmployees(),
    getTodayAttendance(),
    startDate ? getAttendanceForPeriod(rangeStart, rangeEnd) : Promise.resolve([]),
  ]);

  const punchedInIds = new Set(
    todayRecords.filter((r) => !r.punch_out).map((r) => r.employee_id)
  );
  const punchedOutToday = todayRecords.filter((r) => r.punch_out).length;
  const activeEmployees = employees.filter((e) => e.status === "active");
  const notInYet = activeEmployees.length - punchedInIds.size - punchedOutToday;

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Attendance</h1>
        <p className="text-gray-500 font-medium mt-1">Punch in/out and track working hours</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5">
        {[
          { label: "Currently In", value: punchedInIds.size, icon: <UserCheck size={18} />, color: "emerald" },
          { label: "Completed Today", value: punchedOutToday, icon: <Clock size={18} />, color: "blue" },
          { label: "Not In Yet", value: Math.max(0, notInYet), icon: <UserX size={18} />, color: "amber" },
          { label: "Total Employees", value: activeEmployees.length, icon: <Timer size={18} />, color: "gray" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-${color}-50 flex items-center justify-center text-${color}-600`}>
                {icon}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-2xl font-black text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AttendanceClient
        employees={activeEmployees}
        todayRecords={todayRecords}
        rangeRecords={rangeRecords}
        today={today}
      />
    </div>
  );
}
