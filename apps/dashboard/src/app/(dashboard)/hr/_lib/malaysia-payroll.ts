/**
 * Malaysia Payroll Calculations
 *
 * References:
 *  - EPF Act 1991 (3rd Schedule) – employer 13% for wages ≤ RM5,000, 12% above
 *  - SOCSO (Perkeso) 1st & 2nd Schedule – Employment Injury + Invalidity (both),
 *    or Employment Injury only (≥ age 60 / non-Malaysian)
 *  - EIS (Employment Insurance System Act 2017) – 0.2% each, capped at RM4,000
 *  - PCB/MTD – simplified monthly tax deduction using LHDN formula method
 *    (this uses a simplified income-band approach; use e-PCB/LHDN API for exact figures)
 */

// ─────────────────────────────────────────────
// EPF – Employees Provident Fund
// ─────────────────────────────────────────────

/** Round EPF contribution to nearest RM0.10 per EPF rules */
function roundEpf(amount: number): number {
  return Math.ceil(amount * 10) / 10;
}

export function calcEpf(grossSalary: number, employeePct: number, employerPct: number) {
  // EPF wage ceiling: RM100,000 per month (effective 2025)
  const cappedWage = Math.min(grossSalary, 100_000);
  const employee = roundEpf((cappedWage * employeePct) / 100);
  const employer = roundEpf((cappedWage * employerPct) / 100);
  return { employee, employer };
}

/** Determine correct employer EPF % per EPF 3rd Schedule */
export function getEmployerEpfPct(grossSalary: number, employeeAge: number = 30): number {
  if (employeeAge >= 60) return 4; // special rate for ≥60
  if (grossSalary <= 5000) return 13;
  return 12;
}

// ─────────────────────────────────────────────
// SOCSO – Pertubuhan Keselamatan Sosial (Perkeso)
// 1st Schedule: both Employment Injury + Invalidity Scheme
// 2nd Schedule: Employment Injury only (age ≥ 60 or non-Malaysian)
// Wage ceiling: RM5,000 / month
// ─────────────────────────────────────────────

/** SOCSO contribution table (1st Schedule – both schemes)
 *  wages from–to: [employeeContrib, employerContrib]
 */
const SOCSO_TABLE_BOTH: [number, number, number, number][] = [
  // [wageFrom, wageTo, employee, employer]
  [0,      29.99,  0,    0.40],
  [30,     49.99,  0.10, 0.80],
  [50,     69.99,  0.20, 1.20],
  [70,     99.99,  0.30, 1.85],
  [100,    139.99, 0.40, 2.45],
  [140,    199.99, 0.60, 3.45],
  [200,    299.99, 0.85, 5.05],
  [300,    399.99, 1.20, 7.05],
  [400,    499.99, 1.50, 8.70],
  [500,    599.99, 1.85, 10.50],
  [600,    699.99, 2.20, 12.35],
  [700,    799.99, 2.55, 14.05],
  [800,    899.99, 2.90, 15.85],
  [900,    999.99, 3.25, 17.55],
  [1000,   1099.99,3.55, 19.25],
  [1100,   1199.99,3.90, 21.05],
  [1200,   1299.99,4.25, 22.75],
  [1300,   1399.99,4.55, 24.45],
  [1400,   1499.99,4.90, 26.25],
  [1500,   1599.99,5.25, 27.95],
  [1600,   1699.99,5.55, 29.65],
  [1700,   1799.99,5.90, 31.45],
  [1800,   1899.99,6.25, 33.15],
  [1900,   1999.99,6.55, 34.85],
  [2000,   2099.99,6.90, 36.65],
  [2100,   2199.99,7.25, 38.35],
  [2200,   2299.99,7.55, 40.05],
  [2300,   2399.99,7.90, 41.85],
  [2400,   2499.99,8.25, 43.55],
  [2500,   2599.99,8.55, 45.25],
  [2600,   2699.99,8.90, 47.05],
  [2700,   2799.99,9.25, 48.75],
  [2800,   2899.99,9.55, 50.45],
  [2900,   2999.99,9.90, 52.25],
  [3000,   3099.99,10.25,53.95],
  [3100,   3199.99,10.55,55.65],
  [3200,   3299.99,10.90,57.45],
  [3300,   3399.99,11.25,59.15],
  [3400,   3499.99,11.55,60.85],
  [3500,   3599.99,11.90,62.65],
  [3600,   3699.99,12.25,64.35],
  [3700,   3799.99,12.55,66.05],
  [3800,   3899.99,12.90,67.85],
  [3900,   3999.99,13.25,69.55],
  [4000,   4099.99,13.55,71.25],
  [4100,   4199.99,13.90,73.05],
  [4200,   4299.99,14.25,74.75],
  [4300,   4399.99,14.55,76.45],
  [4400,   4499.99,14.90,78.25],
  [4500,   4599.99,15.25,79.95],
  [4600,   4699.99,15.55,81.65],
  [4700,   4799.99,15.90,83.45],
  [4800,   4899.99,16.25,85.15],
  [4900,   4999.99,16.55,86.85],
  [5000,   Infinity,  0,    0  ], // wages > RM5,000 not subject to SOCSO
];

/** SOCSO 2nd Schedule (Employment Injury only – employer only) */
const SOCSO_TABLE_INJURY_ONLY: [number, number, number][] = [
  [0,      29.99,  0.35],
  [30,     49.99,  0.70],
  [50,     69.99,  1.05],
  [70,     99.99,  1.60],
  [100,    139.99, 2.10],
  [140,    199.99, 2.95],
  [200,    299.99, 4.35],
  [300,    399.99, 6.05],
  [400,    499.99, 7.45],
  [500,    599.99, 9.05],
  [600,    699.99, 10.65],
  [700,    799.99, 12.10],
  [800,    899.99, 13.65],
  [900,    999.99, 15.10],
  [1000,   1099.99,16.60],
  [1100,   1199.99,18.15],
  [1200,   1299.99,19.60],
  [1300,   1399.99,21.10],
  [1400,   1499.99,22.65],
  [1500,   1599.99,24.10],
  [1600,   1699.99,25.60],
  [1700,   1799.99,27.15],
  [1800,   1899.99,28.60],
  [1900,   1999.99,30.10],
  [2000,   2099.99,31.65],
  [2100,   2199.99,33.10],
  [2200,   2299.99,34.60],
  [2300,   2399.99,36.15],
  [2400,   2499.99,37.60],
  [2500,   2599.99,39.10],
  [2600,   2699.99,40.65],
  [2700,   2799.99,42.10],
  [2800,   2899.99,43.60],
  [2900,   2999.99,45.15],
  [3000,   3099.99,46.60],
  [3100,   3199.99,48.10],
  [3200,   3299.99,49.65],
  [3300,   3399.99,51.10],
  [3400,   3499.99,52.60],
  [3500,   3599.99,54.15],
  [3600,   3699.99,55.60],
  [3700,   3799.99,57.10],
  [3800,   3899.99,58.65],
  [3900,   3999.99,60.10],
  [4000,   4099.99,61.60],
  [4100,   4199.99,63.15],
  [4200,   4299.99,64.60],
  [4300,   4399.99,66.10],
  [4400,   4499.99,67.65],
  [4500,   4599.99,69.10],
  [4600,   4699.99,70.60],
  [4700,   4799.99,72.15],
  [4800,   4899.99,73.60],
  [4900,   4999.99,75.10],
  [5000,   Infinity, 0  ],
];

export function calcSocso(grossSalary: number, scheme: 'both' | 'employment_injury_only') {
  if (scheme === 'both') {
    const row = SOCSO_TABLE_BOTH.find(([from, to]) => grossSalary >= from && grossSalary <= to);
    if (!row) return { employee: 0, employer: 0 };
    return { employee: row[2], employer: row[3] };
  } else {
    const row = SOCSO_TABLE_INJURY_ONLY.find(([from, to]) => grossSalary >= from && grossSalary <= to);
    if (!row) return { employee: 0, employer: 0 };
    return { employee: 0, employer: row[2] };
  }
}

// ─────────────────────────────────────────────
// EIS – Employment Insurance System
// 0.2% employee + 0.2% employer, capped at RM4,000 wage
// ─────────────────────────────────────────────

export function calcEis(grossSalary: number): { employee: number; employer: number } {
  const cappedWage = Math.min(grossSalary, 4000);
  const rate = 0.002;
  const contribution = parseFloat((cappedWage * rate).toFixed(2));
  return { employee: contribution, employer: contribution };
}

// ─────────────────────────────────────────────
// PCB/MTD – Monthly Tax Deduction (simplified)
// Using income bands based on LHDN schedule.
// For production accuracy, integrate e-PCB API.
// Amounts are monthly tax obligation estimates.
// ─────────────────────────────────────────────

/** Annual chargeable income → annual tax (resident) */
function annualTax(annualChargeable: number): number {
  // Malaysia resident individual tax rates FY2025
  const bands: [number, number, number][] = [
    // [upTo, rate%, prev_tax]
    [5000,     0,   0],
    [20000,    1,   0],
    [35000,    3,   150],
    [50000,    8,   600],
    [70000,   13,  1800],
    [100000,  21,  4400],
    [250000,  24, 10700],
    [400000,  24.5,46700],
    [600000,  25, 83450],
    [1000000, 26, 133450],
    [2000000, 28, 237450],
    [Infinity, 30, 517450],
  ];

  const prevBands = [0, 5000, 20000, 35000, 50000, 70000, 100000, 250000, 400000, 600000, 1000000, 2000000];

  for (let i = 0; i < bands.length; i++) {
    const [upTo, rate, prevTax] = bands[i];
    if (annualChargeable <= upTo) {
      const taxableInBand = annualChargeable - prevBands[i];
      return prevTax + (taxableInBand * rate) / 100;
    }
  }
  return 0;
}

/**
 * Simplified PCB calculation.
 * Deductions used:
 *  - Individual relief: RM9,000 (single) / RM4,000 spouse (if married, non-dual-income)
 *  - Dependent relief: RM2,000 each child
 *  - EPF relief: actual EPF employee contribution (capped RM4,000)
 */
export function calcPcb(params: {
  grossMonthly: number;
  taxCategory: string;       // 'single' | 'married' | 'married_dual_income'
  numDependents: number;
  epfEmployee: number;
  isResident: boolean;
}): number {
  if (!params.isResident) {
    // Non-resident flat 30%
    return parseFloat((params.grossMonthly * 0.3).toFixed(2));
  }

  const annualGross = params.grossMonthly * 12;

  // Reliefs
  const individualRelief = 9000;
  const spouseRelief = params.taxCategory === 'married' ? 4000 : 0;
  const childRelief = params.numDependents * 2000;
  const epfRelief = Math.min(params.epfEmployee * 12, 4000);

  const annualChargeable = Math.max(
    0,
    annualGross - individualRelief - spouseRelief - childRelief - epfRelief
  );

  const annualTaxAmount = annualTax(annualChargeable);
  const monthly = annualTaxAmount / 12;
  return parseFloat(Math.max(0, monthly).toFixed(2));
}

// ─────────────────────────────────────────────
// Overtime Rates – Employment Act 1955
// ─────────────────────────────────────────────

/** Employment Act 1955 overtime rates */
export const OT_RATES = {
  normal_day: 1.5,      // s.60A(3)(a) – work beyond normal hours on work day
  rest_day:   2.0,      // s.60(3)     – work on rest day (> half normal hours)
  public_holiday: 3.0,  // s.60D(3)   – work on public holiday
} as const;

/**
 * Daily rate of pay formula (Employment Act 1955 s.60I):
 * Ordinary Rate of Pay (ORP) = monthly_salary / 26
 * (26 working days per month by statute unless contract states otherwise)
 */
export function calcDailyRate(monthlySalary: number): number {
  return parseFloat((monthlySalary / 26).toFixed(4));
}

export function calcHourlyRate(monthlySalary: number, dailyHours = 8): number {
  return parseFloat((calcDailyRate(monthlySalary) / dailyHours).toFixed(4));
}

export function calcOvertimePay(
  monthlySalary: number,
  overtimeHours: number,
  dayType: keyof typeof OT_RATES = 'normal_day'
): number {
  const hourlyRate = calcHourlyRate(monthlySalary);
  return parseFloat((hourlyRate * OT_RATES[dayType] * overtimeHours).toFixed(2));
}

// ─────────────────────────────────────────────
// Full Payroll Calculation
// ─────────────────────────────────────────────

export interface PayrollInput {
  basicSalary: number;
  overtimeHours?: number;
  overtimeDayType?: keyof typeof OT_RATES;
  allowances?: number;
  epfEmployeePct: number;
  epfEmployerPct: number;
  socsoScheme: 'both' | 'employment_injury_only';
  eisEligible: boolean;
  pcbResident: boolean;
  pcbTaxCategory: string;
  pcbNumDependents: number;
}

export interface PayrollResult {
  basicSalary: number;
  overtimePay: number;
  allowances: number;
  grossSalary: number;
  epfEmployee: number;
  epfEmployer: number;
  socsoEmployee: number;
  socsoEmployer: number;
  eisEmployee: number;
  eisEmployer: number;
  pcb: number;
  totalDeductions: number;
  netSalary: number;
}

export function calcPayroll(input: PayrollInput): PayrollResult {
  const overtimePay = input.overtimeHours
    ? calcOvertimePay(input.basicSalary, input.overtimeHours, input.overtimeDayType)
    : 0;
  const allowances = input.allowances ?? 0;
  const grossSalary = input.basicSalary + overtimePay + allowances;

  const epf = calcEpf(grossSalary, input.epfEmployeePct, input.epfEmployerPct);
  const socso = calcSocso(grossSalary, input.socsoScheme);
  const eis = input.eisEligible ? calcEis(grossSalary) : { employee: 0, employer: 0 };
  const pcb = calcPcb({
    grossMonthly: grossSalary,
    taxCategory: input.pcbTaxCategory,
    numDependents: input.pcbNumDependents,
    epfEmployee: epf.employee,
    isResident: input.pcbResident,
  });

  const totalDeductions = epf.employee + socso.employee + eis.employee + pcb;
  const netSalary = parseFloat(Math.max(0, grossSalary - totalDeductions).toFixed(2));

  return {
    basicSalary: input.basicSalary,
    overtimePay,
    allowances,
    grossSalary: parseFloat(grossSalary.toFixed(2)),
    epfEmployee: epf.employee,
    epfEmployer: epf.employer,
    socsoEmployee: socso.employee,
    socsoEmployer: socso.employer,
    eisEmployee: eis.employee,
    eisEmployer: eis.employer,
    pcb,
    totalDeductions: parseFloat(totalDeductions.toFixed(2)),
    netSalary,
  };
}
