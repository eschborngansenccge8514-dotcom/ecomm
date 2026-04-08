-- HR Schema: Employees, Attendance (Punch In/Out), Payroll
-- Compliant with Malaysia Employment Act 1955 & EPF/SOCSO/EIS/PCB rules

-- ─────────────────────────────────────────────
-- 1. EMPLOYEES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id         UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Personal
  full_name           TEXT NOT NULL,
  ic_number           TEXT,                        -- MyKad / passport
  email               TEXT,
  phone               TEXT,
  date_of_birth       DATE,
  nationality         TEXT DEFAULT 'Malaysian',

  -- Employment
  employee_no         TEXT,
  department          TEXT,
  job_title           TEXT,
  employment_type     TEXT NOT NULL DEFAULT 'full_time', -- full_time | part_time | contract
  start_date          DATE NOT NULL,
  end_date            DATE,                        -- null = still active
  status              TEXT NOT NULL DEFAULT 'active', -- active | inactive | terminated

  -- Compensation
  salary_type         TEXT NOT NULL DEFAULT 'monthly', -- monthly | hourly | daily
  basic_salary        NUMERIC(12,2) NOT NULL DEFAULT 0,
  hourly_rate         NUMERIC(10,2),               -- for hourly workers
  daily_rate          NUMERIC(10,2),               -- for daily workers

  -- Statutory (Malaysia)
  epf_employee_pct    NUMERIC(5,2) NOT NULL DEFAULT 11.00,   -- employee EPF %
  epf_employer_pct    NUMERIC(5,2) NOT NULL DEFAULT 13.00,   -- employer EPF % (≥RM5k: 12%)
  socso_scheme        TEXT NOT NULL DEFAULT 'both',          -- both | employment_injury_only
  eis_eligible        BOOLEAN NOT NULL DEFAULT TRUE,
  pcb_resident        BOOLEAN NOT NULL DEFAULT TRUE,
  pcb_tax_category    TEXT NOT NULL DEFAULT 'single',        -- single | married | married_dual_income
  pcb_num_dependents  INT NOT NULL DEFAULT 0,

  -- Bank
  bank_name           TEXT,
  bank_account_no     TEXT,

  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant_own_employees" ON employees
  USING (merchant_id = (SELECT id FROM merchants WHERE owner_id = auth.uid() LIMIT 1));

-- ─────────────────────────────────────────────
-- 2. ATTENDANCE (Punch In / Out)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  punch_in        TIMESTAMPTZ NOT NULL,
  punch_out       TIMESTAMPTZ,
  break_minutes   INT NOT NULL DEFAULT 0,           -- deducted from work hours

  work_date       DATE NOT NULL,                    -- local date for grouping
  is_overtime     BOOLEAN NOT NULL DEFAULT FALSE,
  overtime_hours  NUMERIC(5,2) NOT NULL DEFAULT 0,

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant_own_attendance" ON attendance
  USING (merchant_id = (SELECT id FROM merchants WHERE owner_id = auth.uid() LIMIT 1));

CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, work_date);

-- ─────────────────────────────────────────────
-- 3. PAYROLL RUNS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  period_year     INT NOT NULL,
  period_month    INT NOT NULL,         -- 1–12
  status          TEXT NOT NULL DEFAULT 'draft', -- draft | finalized | paid

  total_gross     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_epf_ee    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_epf_er    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_socso_ee  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_socso_er  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_eis_ee    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_eis_er    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_pcb       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_net       NUMERIC(14,2) NOT NULL DEFAULT 0,

  notes           TEXT,
  finalized_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (merchant_id, period_year, period_month)
);

ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant_own_payroll_runs" ON payroll_runs
  USING (merchant_id = (SELECT id FROM merchants WHERE owner_id = auth.uid() LIMIT 1));

-- ─────────────────────────────────────────────
-- 4. PAYROLL ITEMS (per-employee line inside a run)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id      UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  merchant_id         UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Earnings
  basic_salary        NUMERIC(12,2) NOT NULL DEFAULT 0,
  overtime_pay        NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances          NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_salary        NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Work summary
  work_days           NUMERIC(5,1) NOT NULL DEFAULT 0,
  work_hours          NUMERIC(7,2) NOT NULL DEFAULT 0,
  overtime_hours      NUMERIC(7,2) NOT NULL DEFAULT 0,

  -- EPF (Employees Provident Fund)
  epf_employee        NUMERIC(12,2) NOT NULL DEFAULT 0,
  epf_employer        NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- SOCSO (Perkeso) – employee + employer
  socso_employee      NUMERIC(12,2) NOT NULL DEFAULT 0,
  socso_employer      NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- EIS (Employment Insurance System)
  eis_employee        NUMERIC(12,2) NOT NULL DEFAULT 0,
  eis_employer        NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- PCB / MTD (Monthly Tax Deduction)
  pcb                 NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Net
  total_deductions    NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary          NUMERIC(12,2) NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant_own_payroll_items" ON payroll_items
  USING (merchant_id = (SELECT id FROM merchants WHERE owner_id = auth.uid() LIMIT 1));
