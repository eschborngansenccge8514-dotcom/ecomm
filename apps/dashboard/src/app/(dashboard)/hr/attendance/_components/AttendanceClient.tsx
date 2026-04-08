"use client";

import { useState, useTransition, useEffect } from "react";
import { punchIn, punchOut } from "../../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LogIn, LogOut, Clock } from "lucide-react";
import toast from "react-hot-toast";

type Employee = Record<string, unknown>;
type AttendanceRecord = Record<string, unknown>;

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso as string).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(punchIn: string, punchOut: string | null | undefined, breakMins: number) {
  const end = punchOut ? new Date(punchOut) : new Date();
  const mins = (end.getTime() - new Date(punchIn).getTime()) / 60000 - breakMins;
  const h = Math.floor(Math.max(0, mins) / 60);
  const m = Math.round(Math.max(0, mins) % 60);
  return `${h}h ${m}m`;
}

export function AttendanceClient({
  employees,
  todayRecords: initialToday,
  rangeRecords,
  today,
}: {
  employees: Employee[];
  todayRecords: AttendanceRecord[];
  rangeRecords: AttendanceRecord[];
  today: string;
}) {
  const [todayRecords, setTodayRecords] = useState(initialToday);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [now, setNow] = useState(new Date());
  const [isPending, startTransition] = useTransition();

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Map of employee_id → open record (no punch_out)
  const openRecordMap = new Map(
    todayRecords.filter((r) => !r.punch_out).map((r) => [String(r.employee_id), r])
  );

  const selectedOpen = selectedEmployee ? openRecordMap.get(selectedEmployee) : null;

  function handlePunchIn() {
    if (!selectedEmployee) return;
    startTransition(async () => {
      try {
        const record = await punchIn(selectedEmployee);
        setTodayRecords((prev) => [record as AttendanceRecord, ...prev]);
        toast.success("Punched in successfully");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function handlePunchOut() {
    if (!selectedOpen) return;
    startTransition(async () => {
      try {
        await punchOut(String(selectedOpen.id), parseInt(breakMinutes) || 0);
        setTodayRecords((prev) =>
          prev.map((r) =>
            r.id === selectedOpen.id
              ? { ...r, punch_out: new Date().toISOString(), break_minutes: parseInt(breakMinutes) || 0 }
              : r
          )
        );
        toast.success("Punched out");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const selectedEmp = employees.find((e) => String(e.id) === selectedEmployee);

  return (
    <div className="space-y-6">
      {/* Punch In/Out Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-base font-bold text-gray-900 mb-5">Clock In / Clock Out</h2>

        {/* Live clock */}
        <div className="text-center mb-6">
          <p className="text-5xl font-black text-gray-900 tracking-tight font-mono">
            {now.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {now.toLocaleDateString("en-MY", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <Select value={selectedEmployee} onValueChange={(v) => setSelectedEmployee(v || '')}>
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder="Select employee..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={String(emp.id)} value={String(emp.id)}>
                  <span className="font-medium">{String(emp.full_name)}</span>
                  {Boolean(emp.employee_no) && <span className="text-gray-400 ml-2">#{String(emp.employee_no)}</span>}
                  {openRecordMap.has(String(emp.id)) && (
                    <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-0 text-xs">In</Badge>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedOpen && (
            <div className="bg-emerald-50 rounded-xl p-4 text-sm">
              <p className="text-emerald-700 font-semibold">
                Punched in at {formatTime(String(selectedOpen.punch_in))} ·{" "}
                {formatDuration(String(selectedOpen.punch_in), null, 0)} elapsed
              </p>
              <div className="mt-3 flex items-center gap-3">
                <label className="text-emerald-700 text-xs font-medium whitespace-nowrap">Break (min)</label>
                <Input
                  type="number"
                  min="0"
                  className="h-8 w-24 rounded-lg"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                />
              </div>
            </div>
          )}

          {selectedEmployee && !selectedOpen && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
              {selectedEmp ? `${selectedEmp.full_name} is not clocked in today.` : ""}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
              onClick={handlePunchIn}
              disabled={isPending || !selectedEmployee || !!selectedOpen}
            >
              <LogIn size={16} /> Punch In
            </Button>
            <Button
              className="flex-1 h-12 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold gap-2"
              onClick={handlePunchOut}
              disabled={isPending || !selectedOpen}
            >
              <LogOut size={16} /> Punch Out
            </Button>
          </div>
        </div>
      </div>

      {/* Today's Records */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Today&apos;s Attendance — {today}</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-semibold">Employee</th>
              <th className="text-left px-5 py-3 font-semibold">Punch In</th>
              <th className="text-left px-5 py-3 font-semibold">Punch Out</th>
              <th className="text-left px-5 py-3 font-semibold">Break</th>
              <th className="text-left px-5 py-3 font-semibold">Duration</th>
              <th className="text-left px-5 py-3 font-semibold">OT</th>
              <th className="text-left px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {todayRecords.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">No attendance records today.</td>
              </tr>
            )}
            {todayRecords.map((rec) => {
              const emp = (rec.employees as Record<string, unknown>) ?? {};
              return (
                <tr key={String(rec.id)} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{String(emp.full_name ?? "—")}</td>
                  <td className="px-5 py-3 font-mono text-gray-700">{formatTime(rec.punch_in as string)}</td>
                  <td className="px-5 py-3 font-mono text-gray-700">{formatTime(rec.punch_out as string | null)}</td>
                  <td className="px-5 py-3 text-gray-500">{rec.break_minutes ? `${rec.break_minutes}m` : "—"}</td>
                  <td className="px-5 py-3 font-medium text-gray-700 flex items-center gap-1">
                    <Clock size={12} className="text-gray-400" />
                    {formatDuration(rec.punch_in as string, rec.punch_out as string | null, Number(rec.break_minutes ?? 0))}
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {Number(rec.overtime_hours) > 0
                      ? <Badge className="bg-amber-100 text-amber-700 border-0">{Number(rec.overtime_hours).toFixed(1)}h OT</Badge>
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {rec.punch_out
                      ? <Badge className="bg-blue-100 text-blue-700 border-0">Completed</Badge>
                      : <Badge className="bg-emerald-100 text-emerald-700 border-0">In Progress</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Range Records */}
      {rangeRecords.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Attendance History</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">Date</th>
                <th className="text-left px-5 py-3 font-semibold">Employee</th>
                <th className="text-left px-5 py-3 font-semibold">In</th>
                <th className="text-left px-5 py-3 font-semibold">Out</th>
                <th className="text-left px-5 py-3 font-semibold">Hours</th>
                <th className="text-left px-5 py-3 font-semibold">OT Hours</th>
              </tr>
            </thead>
            <tbody>
              {rangeRecords.map((rec) => {
                const emp = (rec.employees as Record<string, unknown>) ?? {};
                return (
                  <tr key={String(rec.id)} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-500">{String(rec.work_date)}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{String(emp.full_name ?? "—")}</td>
                    <td className="px-5 py-3 font-mono text-sm">{formatTime(rec.punch_in as string)}</td>
                    <td className="px-5 py-3 font-mono text-sm">{formatTime(rec.punch_out as string | null)}</td>
                    <td className="px-5 py-3">
                      {rec.punch_out ? formatDuration(rec.punch_in as string, rec.punch_out as string, Number(rec.break_minutes ?? 0)) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {Number(rec.overtime_hours) > 0 ? `${Number(rec.overtime_hours).toFixed(1)}h` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
