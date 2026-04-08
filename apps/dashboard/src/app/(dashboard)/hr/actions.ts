"use server";

import { getAuthContext } from "@/lib/utils.server";
import { revalidatePath } from "next/cache";
import { calcPayroll, getEmployerEpfPct, type PayrollInput } from "./_lib/malaysia-payroll";

// ─────────────────────────────────────────────
// EMPLOYEES
// ─────────────────────────────────────────────

export async function getEmployees() {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) return [];

  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("full_name");

  if (error) { console.error(error); return []; }
  return data ?? [];
}

export async function getEmployee(id: string) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) return null;

  const { data } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .single();

  return data;
}

export async function createEmployee(input: Record<string, unknown>) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("employees")
    .insert({ ...input, merchant_id: merchant.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/hr/employees");
  return data;
}

export async function updateEmployee(id: string, input: Record<string, unknown>) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("employees")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("merchant_id", merchant.id);

  if (error) throw new Error(error.message);
  revalidatePath("/hr/employees");
}

export async function deleteEmployee(id: string) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("employees")
    .update({ status: "terminated", end_date: new Date().toISOString().split("T")[0] })
    .eq("id", id)
    .eq("merchant_id", merchant.id);

  if (error) throw new Error(error.message);
  revalidatePath("/hr/employees");
}

// ─────────────────────────────────────────────
// ATTENDANCE – Punch In / Out
// ─────────────────────────────────────────────

export async function getTodayAttendance(employeeId?: string) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) return [];

  const today = new Date().toISOString().split("T")[0];
  let query = supabase
    .from("attendance")
    .select("*, employees(full_name, employee_no, job_title)")
    .eq("merchant_id", merchant.id)
    .eq("work_date", today)
    .order("punch_in", { ascending: false });

  if (employeeId) query = query.eq("employee_id", employeeId);

  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return data ?? [];
}

export async function getAttendanceForPeriod(
  startDate: string,
  endDate: string,
  employeeId?: string
) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) return [];

  let query = supabase
    .from("attendance")
    .select("*, employees(full_name, employee_no)")
    .eq("merchant_id", merchant.id)
    .gte("work_date", startDate)
    .lte("work_date", endDate)
    .order("work_date", { ascending: false });

  if (employeeId) query = query.eq("employee_id", employeeId);

  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return data ?? [];
}

export async function punchIn(employeeId: string) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) throw new Error("Unauthorized");

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Check already punched in today without punch-out
  const { data: existing } = await supabase
    .from("attendance")
    .select("id, punch_out")
    .eq("employee_id", employeeId)
    .eq("work_date", today)
    .is("punch_out", null)
    .maybeSingle();

  if (existing) throw new Error("Employee is already punched in. Please punch out first.");

  const { data, error } = await supabase
    .from("attendance")
    .insert({
      merchant_id: merchant.id,
      employee_id: employeeId,
      punch_in: now.toISOString(),
      work_date: today,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/hr/attendance");
  return data;
}

export async function punchOut(attendanceId: string, breakMinutes = 0) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) throw new Error("Unauthorized");

  // Fetch to calc overtime
  const { data: record, error: fetchError } = await supabase
    .from("attendance")
    .select("*, employees(basic_salary, salary_type)")
    .eq("id", attendanceId)
    .eq("merchant_id", merchant.id)
    .single();

  if (fetchError || !record) throw new Error("Attendance record not found");
  if (record.punch_out) throw new Error("Already punched out");

  const now = new Date();
  const punchIn = new Date(record.punch_in);
  const totalMinutes = (now.getTime() - punchIn.getTime()) / 60000 - breakMinutes;
  const workHours = Math.max(0, totalMinutes / 60);

  // Employment Act 1955: normal hours = 8h/day, overtime if > 8h
  const NORMAL_HOURS = 8;
  const overtimeHours = Math.max(0, workHours - NORMAL_HOURS);
  const isOvertime = overtimeHours > 0;

  const { error } = await supabase
    .from("attendance")
    .update({
      punch_out: now.toISOString(),
      break_minutes: breakMinutes,
      is_overtime: isOvertime,
      overtime_hours: parseFloat(overtimeHours.toFixed(2)),
      updated_at: now.toISOString(),
    })
    .eq("id", attendanceId)
    .eq("merchant_id", merchant.id);

  if (error) throw new Error(error.message);
  revalidatePath("/hr/attendance");
  return { workHours: parseFloat(workHours.toFixed(2)), overtimeHours: parseFloat(overtimeHours.toFixed(2)) };
}

// ─────────────────────────────────────────────
// PAYROLL
// ─────────────────────────────────────────────

export async function getPayrollRuns() {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) return [];

  const { data, error } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false });

  if (error) { console.error(error); return []; }
  return data ?? [];
}

export async function getPayrollItems(runId: string) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) return [];

  const { data, error } = await supabase
    .from("payroll_items")
    .select("*, employees(full_name, employee_no, job_title, department, bank_name, bank_account_no)")
    .eq("payroll_run_id", runId)
    .eq("merchant_id", merchant.id)
    .order("employees(full_name)");

  if (error) { console.error(error); return []; }
  return data ?? [];
}

/** Generate payroll for a given month */
export async function generatePayrollRun(year: number, month: number) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) throw new Error("Unauthorized");

  // Check not already generated
  const { data: existing } = await supabase
    .from("payroll_runs")
    .select("id, status")
    .eq("merchant_id", merchant.id)
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();

  if (existing?.status === "finalized") {
    throw new Error("Payroll for this period is already finalized.");
  }

  // Date range for the month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  // Fetch all active employees
  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .eq("merchant_id", merchant.id)
    .eq("status", "active");

  if (!employees?.length) throw new Error("No active employees found.");

  // Fetch attendance for this month
  const { data: attendanceRecords } = await supabase
    .from("attendance")
    .select("employee_id, work_date, punch_in, punch_out, break_minutes, overtime_hours")
    .eq("merchant_id", merchant.id)
    .gte("work_date", startDate)
    .lte("work_date", endDate)
    .not("punch_out", "is", null);

  const attendanceMap: Record<string, typeof attendanceRecords> = {};
  for (const rec of attendanceRecords ?? []) {
    if (!attendanceMap[rec.employee_id]) attendanceMap[rec.employee_id] = [];
    attendanceMap[rec.employee_id]!.push(rec);
  }

  // Calculate per-employee payroll
  const items = employees.map((emp) => {
    const empAttendance = attendanceMap[emp.id] ?? [];
    const workDays = empAttendance.length;
    let workHours = 0;
    let totalOvertimeHours = 0;

    for (const rec of empAttendance) {
      if (rec.punch_in && rec.punch_out) {
        const mins = (new Date(rec.punch_out).getTime() - new Date(rec.punch_in).getTime()) / 60000;
        workHours += Math.max(0, (mins - (rec.break_minutes ?? 0)) / 60);
      }
      totalOvertimeHours += Number(rec.overtime_hours ?? 0);
    }

    // Prorate salary for hourly / daily workers
    let basicSalary = Number(emp.basic_salary);
    if (emp.salary_type === "hourly" && emp.hourly_rate) {
      basicSalary = Number(emp.hourly_rate) * workHours;
    } else if (emp.salary_type === "daily" && emp.daily_rate) {
      basicSalary = Number(emp.daily_rate) * workDays;
    }

    const employerEpfPct = getEmployerEpfPct(basicSalary);

    const payrollInput: PayrollInput = {
      basicSalary,
      overtimeHours: totalOvertimeHours,
      overtimeDayType: "normal_day",
      allowances: 0,
      epfEmployeePct: Number(emp.epf_employee_pct),
      epfEmployerPct: employerEpfPct,
      socsoScheme: emp.socso_scheme as "both" | "employment_injury_only",
      eisEligible: emp.eis_eligible,
      pcbResident: emp.pcb_resident,
      pcbTaxCategory: emp.pcb_tax_category,
      pcbNumDependents: Number(emp.pcb_num_dependents),
    };

    const result = calcPayroll(payrollInput);

    return {
      employee_id: emp.id,
      merchant_id: merchant.id,
      basic_salary: result.basicSalary,
      overtime_pay: result.overtimePay,
      allowances: result.allowances,
      gross_salary: result.grossSalary,
      work_days: workDays,
      work_hours: parseFloat(workHours.toFixed(2)),
      overtime_hours: parseFloat(totalOvertimeHours.toFixed(2)),
      epf_employee: result.epfEmployee,
      epf_employer: result.epfEmployer,
      socso_employee: result.socsoEmployee,
      socso_employer: result.socsoEmployer,
      eis_employee: result.eisEmployee,
      eis_employer: result.eisEmployer,
      pcb: result.pcb,
      total_deductions: result.totalDeductions,
      net_salary: result.netSalary,
    };
  });

  // Aggregate totals
  const totals = items.reduce(
    (acc, item) => ({
      total_gross: acc.total_gross + item.gross_salary,
      total_epf_ee: acc.total_epf_ee + item.epf_employee,
      total_epf_er: acc.total_epf_er + item.epf_employer,
      total_socso_ee: acc.total_socso_ee + item.socso_employee,
      total_socso_er: acc.total_socso_er + item.socso_employer,
      total_eis_ee: acc.total_eis_ee + item.eis_employee,
      total_eis_er: acc.total_eis_er + item.eis_employer,
      total_pcb: acc.total_pcb + item.pcb,
      total_net: acc.total_net + item.net_salary,
    }),
    { total_gross: 0, total_epf_ee: 0, total_epf_er: 0, total_socso_ee: 0, total_socso_er: 0, total_eis_ee: 0, total_eis_er: 0, total_pcb: 0, total_net: 0 }
  );

  // Upsert payroll run
  const runPayload = {
    merchant_id: merchant.id,
    period_year: year,
    period_month: month,
    status: "draft",
    ...totals,
    updated_at: new Date().toISOString(),
  };

  let runId: string;
  if (existing) {
    await supabase.from("payroll_runs").update(runPayload).eq("id", existing.id);
    runId = existing.id;
    // Clear old items
    await supabase.from("payroll_items").delete().eq("payroll_run_id", runId);
  } else {
    const { data: run, error } = await supabase
      .from("payroll_runs")
      .insert(runPayload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    runId = run.id;
  }

  // Insert items
  const itemsWithRunId = items.map((i) => ({ ...i, payroll_run_id: runId }));
  const { error: itemsError } = await supabase.from("payroll_items").insert(itemsWithRunId);
  if (itemsError) throw new Error(itemsError.message);

  revalidatePath("/hr/payroll");
  return { runId, itemCount: items.length };
}

export async function finalizePayrollRun(runId: string) {
  const { supabase, merchant } = await getAuthContext();
  if (!merchant) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("payroll_runs")
    .update({ status: "finalized", finalized_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("merchant_id", merchant.id);

  if (error) throw new Error(error.message);
  revalidatePath("/hr/payroll");
}
