"use client";

import { useState, useTransition, Fragment } from "react";
import { createEmployee, updateEmployee, deleteEmployee } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Pencil, Trash2, Search, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";

type Employee = Record<string, unknown>;

const EMPTY_FORM = {
  full_name: "",
  ic_number: "",
  email: "",
  phone: "",
  employee_no: "",
  department: "",
  job_title: "",
  employment_type: "full_time",
  start_date: "",
  salary_type: "monthly",
  basic_salary: "",
  hourly_rate: "",
  daily_rate: "",
  epf_employee_pct: "11",
  epf_employer_pct: "13",
  socso_scheme: "both",
  eis_eligible: "true",
  pcb_resident: "true",
  pcb_tax_category: "single",
  pcb_num_dependents: "0",
  bank_name: "",
  bank_account_no: "",
};

export function EmployeesClient({ employees: initial }: { employees: Employee[] }) {
  const [employees, setEmployees] = useState(initial);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = employees.filter((e) =>
    String(e.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    String(e.employee_no ?? "").toLowerCase().includes(search.toLowerCase()) ||
    String(e.department ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      full_name: String(emp.full_name ?? ""),
      ic_number: String(emp.ic_number ?? ""),
      email: String(emp.email ?? ""),
      phone: String(emp.phone ?? ""),
      employee_no: String(emp.employee_no ?? ""),
      department: String(emp.department ?? ""),
      job_title: String(emp.job_title ?? ""),
      employment_type: String(emp.employment_type ?? "full_time"),
      start_date: String(emp.start_date ?? ""),
      salary_type: String(emp.salary_type ?? "monthly"),
      basic_salary: String(emp.basic_salary ?? ""),
      hourly_rate: String(emp.hourly_rate ?? ""),
      daily_rate: String(emp.daily_rate ?? ""),
      epf_employee_pct: String(emp.epf_employee_pct ?? "11"),
      epf_employer_pct: String(emp.epf_employer_pct ?? "13"),
      socso_scheme: String(emp.socso_scheme ?? "both"),
      eis_eligible: String(emp.eis_eligible ?? "true"),
      pcb_resident: String(emp.pcb_resident ?? "true"),
      pcb_tax_category: String(emp.pcb_tax_category ?? "single"),
      pcb_num_dependents: String(emp.pcb_num_dependents ?? "0"),
      bank_name: String(emp.bank_name ?? ""),
      bank_account_no: String(emp.bank_account_no ?? ""),
    });
    setShowForm(true);
  }

  function handleSave() {
    startTransition(async () => {
      const payload = {
        ...form,
        basic_salary: parseFloat(form.basic_salary) || 0,
        hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
        daily_rate: form.daily_rate ? parseFloat(form.daily_rate) : null,
        epf_employee_pct: parseFloat(form.epf_employee_pct),
        epf_employer_pct: parseFloat(form.epf_employer_pct),
        eis_eligible: form.eis_eligible === "true",
        pcb_resident: form.pcb_resident === "true",
        pcb_num_dependents: parseInt(form.pcb_num_dependents),
      };

      try {
        if (editing) {
          await updateEmployee(String(editing.id), payload);
          setEmployees((prev) => prev.map((e) => e.id === editing.id ? { ...e, ...payload } : e));
          toast.success("Employee updated");
        } else {
          const created = await createEmployee(payload);
          setEmployees((prev) => [...prev, created]);
          toast.success("Employee added");
        }
        setShowForm(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Mark this employee as terminated?")) return;
    startTransition(async () => {
      try {
        await deleteEmployee(id);
        setEmployees((prev) => prev.map((e) => e.id === id ? { ...e, status: "terminated" } : e));
        toast.success("Employee terminated");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const statusBadge = (status: unknown) =>
    status === "active"
      ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>
      : <Badge className="bg-red-100 text-red-600 border-0">Inactive</Badge>;

  const typeBadge = (type: unknown) => {
    const map: Record<string, string> = { full_time: "Full-time", part_time: "Part-time", contract: "Contract" };
    return <Badge variant="outline">{map[String(type)] ?? String(type)}</Badge>;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-9 h-10 rounded-xl"
            placeholder="Search name, ID, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          onClick={openCreate}
          className="h-10 px-5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold gap-2"
        >
          <UserPlus size={16} /> Add Employee
        </Button>
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
            <th className="text-left px-5 py-3 font-semibold">Employee</th>
            <th className="text-left px-5 py-3 font-semibold">Department</th>
            <th className="text-left px-5 py-3 font-semibold">Type</th>
            <th className="text-right px-5 py-3 font-semibold">Salary (RM)</th>
            <th className="text-left px-5 py-3 font-semibold">Status</th>
            <th className="text-right px-5 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-16 text-gray-400">
                No employees found.
              </td>
            </tr>
          )}
          {filtered.map((emp) => (
            <Fragment key={String(emp.id)}>
              <tr
                className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpandedId(expandedId === String(emp.id) ? null : String(emp.id))}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                      {String(emp.full_name ?? "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{String(emp.full_name)}</p>
                      <p className="text-xs text-gray-400">{String(emp.job_title ?? "")} {emp.employee_no ? `· ${emp.employee_no}` : ""}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-600">{String(emp.department ?? "—")}</td>
                <td className="px-5 py-3">{typeBadge(emp.employment_type)}</td>
                <td className="px-5 py-3 text-right font-mono font-semibold text-gray-900">
                  {Number(emp.basic_salary).toLocaleString("en-MY", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3">{statusBadge(emp.status)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={(ev) => { ev.stopPropagation(); openEdit(emp); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(ev) => { ev.stopPropagation(); handleDelete(String(emp.id)); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                    {expandedId === String(emp.id) ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </div>
                </td>
              </tr>
              {expandedId === String(emp.id) && (
                <tr className="bg-gray-50 border-b border-gray-100">
                  <td colSpan={6} className="px-8 py-4">
                    <div className="grid grid-cols-4 gap-4 text-xs">
                      <div><p className="text-gray-400 mb-0.5">IC / Passport</p><p className="font-medium">{String(emp.ic_number ?? "—")}</p></div>
                      <div><p className="text-gray-400 mb-0.5">Email</p><p className="font-medium">{String(emp.email ?? "—")}</p></div>
                      <div><p className="text-gray-400 mb-0.5">Phone</p><p className="font-medium">{String(emp.phone ?? "—")}</p></div>
                      <div><p className="text-gray-400 mb-0.5">Start Date</p><p className="font-medium">{String(emp.start_date ?? "—")}</p></div>
                      <div><p className="text-gray-400 mb-0.5">EPF (Employee)</p><p className="font-medium">{String(emp.epf_employee_pct)}%</p></div>
                      <div><p className="text-gray-400 mb-0.5">EPF (Employer)</p><p className="font-medium">{String(emp.epf_employer_pct)}%</p></div>
                      <div><p className="text-gray-400 mb-0.5">SOCSO Scheme</p><p className="font-medium">{emp.socso_scheme === "both" ? "Both Schemes" : "Employment Injury Only"}</p></div>
                      <div><p className="text-gray-400 mb-0.5">PCB Category</p><p className="font-medium capitalize">{String(emp.pcb_tax_category).replace("_", " ")}</p></div>
                      <div><p className="text-gray-400 mb-0.5">Bank</p><p className="font-medium">{String(emp.bank_name ?? "—")}</p></div>
                      <div><p className="text-gray-400 mb-0.5">Account No.</p><p className="font-medium">{String(emp.bank_account_no ?? "—")}</p></div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <Section title="Personal Info">
              <Field label="Full Name *">
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </Field>
              <Field label="IC / Passport No.">
                <Input value={form.ic_number} onChange={(e) => setForm({ ...form, ic_number: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </Section>

            <Section title="Employment">
              <Field label="Employee No.">
                <Input value={form.employee_no} onChange={(e) => setForm({ ...form, employee_no: e.target.value })} />
              </Field>
              <Field label="Department">
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </Field>
              <Field label="Job Title">
                <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
              </Field>
              <Field label="Start Date *">
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </Field>
              <Field label="Employment Type">
                <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v || "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-time</SelectItem>
                    <SelectItem value="part_time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Salary Type">
                <Select value={form.salary_type} onValueChange={(v) => setForm({ ...form, salary_type: v || "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {form.salary_type === "monthly" && (
                <Field label="Basic Salary (RM)">
                  <Input type="number" step="0.01" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} />
                </Field>
              )}
              {form.salary_type === "hourly" && (
                <Field label="Hourly Rate (RM)">
                  <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
                </Field>
              )}
              {form.salary_type === "daily" && (
                <Field label="Daily Rate (RM)">
                  <Input type="number" step="0.01" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} />
                </Field>
              )}
            </Section>

            <Section title="Statutory Contributions (Malaysia)">
              <Field label="EPF Employee (%)">
                <Input type="number" step="0.01" value={form.epf_employee_pct} onChange={(e) => setForm({ ...form, epf_employee_pct: e.target.value })} />
              </Field>
              <Field label="EPF Employer (%)">
                <Select value={form.epf_employer_pct} onValueChange={(v) => setForm({ ...form, epf_employer_pct: v || "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="13">13% (salary ≤ RM5,000)</SelectItem>
                    <SelectItem value="12">12% (salary &gt; RM5,000)</SelectItem>
                    <SelectItem value="4">4% (age ≥ 60)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="SOCSO Scheme">
                <Select value={form.socso_scheme} onValueChange={(v) => setForm({ ...form, socso_scheme: v || "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both Schemes (Employment Injury + Invalidity)</SelectItem>
                    <SelectItem value="employment_injury_only">Employment Injury Only (age ≥ 60 / non-Malaysian)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="EIS Eligible">
                <Select value={form.eis_eligible} onValueChange={(v) => setForm({ ...form, eis_eligible: v || "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="PCB Resident">
                <Select value={form.pcb_resident} onValueChange={(v) => setForm({ ...form, pcb_resident: v || "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Resident</SelectItem>
                    <SelectItem value="false">Non-Resident (flat 30%)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tax Category">
                <Select value={form.pcb_tax_category} onValueChange={(v) => setForm({ ...form, pcb_tax_category: v || "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married (spouse not working)</SelectItem>
                    <SelectItem value="married_dual_income">Married (both working)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="No. of Dependents">
                <Input type="number" min="0" value={form.pcb_num_dependents} onChange={(e) => setForm({ ...form, pcb_num_dependents: e.target.value })} />
              </Field>
            </Section>

            <Section title="Bank Details">
              <Field label="Bank Name">
                <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
              </Field>
              <Field label="Account No.">
                <Input value={form.bank_account_no} onChange={(e) => setForm({ ...form, bank_account_no: e.target.value })} />
              </Field>
            </Section>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={isPending || !form.full_name || !form.start_date}
                className="rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold"
              >
                {isPending ? "Saving..." : editing ? "Update" : "Add Employee"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">{label}</Label>
      {children}
    </div>
  );
}
