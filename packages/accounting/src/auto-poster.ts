import { getSystemAccountsByMerchant } from './chart-of-accounts';
import { insertJournalEntry, JournalLineInput } from './journal';

export interface POSTransaction {
  merchantId:   string;
  totalAmount:  number;
  subtotal:     number;
  sstAmount:    number;
  cogsAmount:   number;
  createdAt:    Date;
  txnRef:       string;
  paymentMethod: 'cash' | 'card' | 'ewallet';
  gatewayFee?:   number;
}

export interface POSSessionSummary {
  merchantId: string;
  sessionId: string;
  sessionNo: string;
  totalSubtotal: number;
  totalTax: number;
  totalTotal: number;
  totalCogs: number;
  cashTotal: number;
  cardTotal: number;
  ewalletTotal: number;
  date: Date;
}

/**
 * Automates journal entry creation for POS sales.
 * Covers Revenue, SST, Cash/Bank, and optional COGS/Inventory.
 */
export async function postPOSSale(txn: POSTransaction) {
  const accts = await getSystemAccountsByMerchant(txn.merchantId);

  // Validation
  if (!accts.CASH_BANK || !accts.SALES_REVENUE || !accts.SST_PAYABLE) {
    throw new Error(`Required system accounts (Cash, Revenue, SST) missing for merchant ${txn.merchantId}`);
  }

  const lines: JournalLineInput[] = [];
  const paymentAccountId = txn.paymentMethod === 'cash' 
    ? (accts.PETTY_CASH || accts.CASH_BANK) 
    : accts.CASH_BANK;

  // 1. Asset: Cash & Bank / Petty Cash (Money received)
  // Reflect net amount if fees are deducted at source (common for cards)
  const netAmount = txn.totalAmount - (txn.gatewayFee || 0);
  lines.push({
    accountId: paymentAccountId,
    debit:     netAmount,
    credit:    0,
    description: `Payment via ${txn.paymentMethod}`
  });

  // 2. Expense: Gateway Fees (if applicable)
  if (txn.gatewayFee && txn.gatewayFee > 0) {
    if (!accts.GATEWAY_FEES) throw new Error(`Gateway Fees account missing for merchant ${txn.merchantId}`);
    lines.push({
      accountId: accts.GATEWAY_FEES,
      debit:     txn.gatewayFee,
      credit:    0,
      description: 'Transaction processing fee'
    });
  }

  // 3. Revenue: Sales Revenue
  lines.push({
    accountId: accts.SALES_REVENUE,
    debit:     0,
    credit:    txn.subtotal,
    description: 'Product sales'
  });

  // 4. Liability: SST Payable
  if (txn.sstAmount > 0) {
    lines.push({
      accountId: accts.SST_PAYABLE,
      debit:     0,
      credit:    txn.sstAmount,
      description: 'SST Collected'
    });
  }

  // 5. COGS & Inventory (if COGS tracking is enabled/provided)
  if (txn.cogsAmount > 0) {
    if (!accts.COGS || !accts.INVENTORY) {
       console.warn(`COGS amount RM${txn.cogsAmount} provided but COGS/Inventory accounts are missing. Skipping inventory movement.`);
    } else {
      lines.push(
        { 
          accountId: accts.COGS, 
          debit:     txn.cogsAmount, 
          credit:    0,
          description: 'Cost of Goods Sold'
        },
        { 
          accountId: accts.INVENTORY, 
          debit:     0, 
          credit:    txn.cogsAmount,
          description: 'Inventory reduction'
        }
      );
    }
  }

  return await insertJournalEntry({
    merchantId:  txn.merchantId,
    date:         txn.createdAt,
    description: `POS Sale — ${txn.txnRef}`,
    sourceType:  'POS',
    sourceRef:    txn.txnRef,
    lines,
  });
}

/**
 * Automates journal entry for a closed POS session (Batch Posting).
 */
export async function postPOSSessionBatch(summary: POSSessionSummary) {
  const accts = await getSystemAccountsByMerchant(summary.merchantId);

  if (!accts.CASH_BANK || !accts.SALES_REVENUE || !accts.SST_PAYABLE) {
    throw new Error(`Required accounts (Cash, Revenue, SST) missing for merchant ${summary.merchantId}`);
  }

  const lines: JournalLineInput[] = [];

  // 1. Asset: Cash/Bank portions
  if (summary.cashTotal > 0) {
    lines.push({
      accountId: accts.PETTY_CASH || accts.CASH_BANK,
      debit:     summary.cashTotal,
      credit:    0,
      description: 'POS Session Cash Sales'
    });
  }

  if (summary.cardTotal > 0 || summary.ewalletTotal > 0) {
    lines.push({
      accountId: accts.CASH_BANK,
      debit:     summary.cardTotal + summary.ewalletTotal,
      credit:    0,
      description: 'POS Session Non-Cash Sales (Card/eWallet)'
    });
  }

  // 2. Revenue: Sales Revenue
  lines.push({
    accountId: accts.SALES_REVENUE,
    debit:     0,
    credit:    summary.totalSubtotal,
    description: `POS Revenue Summary — ${summary.sessionNo}`
  });

  // 3. Liability: SST Payable
  if (summary.totalTax > 0) {
    lines.push({
      accountId: accts.SST_PAYABLE,
      debit:     0,
      credit:    summary.totalTax,
      description: 'SST Collected (Session Batch)'
    });
  }

  // 4. COGS & Inventory
  if (summary.totalCogs > 0 && accts.COGS && accts.INVENTORY) {
    lines.push(
      { 
        accountId: accts.COGS, 
        debit:     summary.totalCogs, 
        credit:    0,
        description: 'POS Session COGS'
      },
      { 
        accountId: accts.INVENTORY, 
        debit:     0, 
        credit:    summary.totalCogs,
        description: 'POS Session Inventory Update'
      }
    );
  }

  return await insertJournalEntry({
    merchantId:  summary.merchantId,
    date:         summary.date,
    description: `POS Session Closure — ${summary.sessionNo}`,
    sourceType:  'POS',
    sourceRef:    summary.sessionId,
    lines,
  });
}

/**
 * Automates journal entry creation for invoice payments.
 */
export async function postInvoicePayment(data: {
  merchantId: string;
  amount:     number;
  invoiceId:  string;
  paymentRef: string;
  date:       Date;
}) {
  const accts = await getSystemAccountsByMerchant(data.merchantId);

  if (!accts.CASH_BANK || !accts.RECEIVABLES) {
    throw new Error(`Required system accounts (Cash, Receivables) missing for merchant ${data.merchantId}`);
  }

  return await insertJournalEntry({
    merchantId:  data.merchantId,
    date:         data.date,
    description: `Invoice Payment — ${data.invoiceId}`,
    sourceType:  'INVOICE',
    sourceRef:    data.invoiceId,
    lines: [
      { accountId: accts.CASH_BANK,   debit: data.amount, credit: 0 },
      { accountId: accts.RECEIVABLES, debit: 0,           credit: data.amount }
    ]
  });
}

/**
 * Automates journal entry creation for payroll runs.
 * Splits employer contribution into expense accounts (6100) and employee deductions 
 * into separate liability accounts (2310–2330), ready for monthly statutory payment reporting.
 */
export async function postPayroll(data: {
  merchantId: string;
  totalGross: number;
  totalNet:   number;
  epf_ee:     number;
  epf_er:     number;
  socso_ee:   number;
  socso_er:   number;
  eis_ee:     number;
  eis_er:     number;
  pcb:        number;
  date:       Date;
  reference:  string;
}) {
  const accts = await getSystemAccountsByMerchant(data.merchantId);

  if (!accts.SALARIES || !accts.PAYROLL_LIABILITIES || !accts.EPF_PAYABLE || !accts.SOCSO_PAYABLE || !accts.EIS_PAYABLE) {
    throw new Error(`Required payroll statutory accounts missing for merchant ${data.merchantId}`);
  }

  const lines: JournalLineInput[] = [
    // 1. Expense: Gross Salaries (Debit)
    { 
      accountId: accts.SALARIES, 
      debit: data.totalGross, 
      credit: 0, 
      description: 'Gross Salary Expense' 
    },
    
    // 2. Expense: Employer Statutory Contributions (Debit)
    { 
      accountId: accts.SALARIES, 
      debit: data.epf_er + data.socso_er + data.eis_er, 
      credit: 0, 
      description: 'Statutory Contributions (ER)' 
    },

    // 3. Liability: EPF Payable (Credit) - EE + ER portions
    { 
      accountId: accts.EPF_PAYABLE, 
      debit: 0, 
      credit: data.epf_ee + data.epf_er, 
      description: 'EPF Statutory Payable' 
    },
    
    // 4. Liability: SOCSO Payable (Credit) - EE + ER portions
    { 
      accountId: accts.SOCSO_PAYABLE, 
      debit: 0, 
      credit: data.socso_ee + data.socso_er, 
      description: 'SOCSO Statutory Payable' 
    },
    
    // 5. Liability: EIS Payable (Credit) - EE + ER portions
    { 
      accountId: accts.EIS_PAYABLE, 
      debit: 0, 
      credit: data.eis_ee + data.eis_er, 
      description: 'EIS Statutory Payable' 
    },

    // 6. Liability: PCB Payable (Credit)
    { 
      accountId: accts.PAYROLL_LIABILITIES, 
      debit: 0, 
      credit: data.pcb, 
      description: 'Income Tax (PCB) Payable' 
    },

    // 7. Liability: Net Salary Payable (Credit)
    { 
      accountId: accts.PAYROLL_LIABILITIES, 
      debit: 0, 
      credit: data.totalNet, 
      description: 'Net Salary Payable to Employees' 
    },
  ];

  return await insertJournalEntry({
    merchantId:  data.merchantId,
    date:        data.date,
    description: `Payroll Run — ${data.reference}`,
    sourceType:  'PAYROLL',
    sourceRef:   data.reference,
    lines,
  });
}

/**
 * Automates journal entry for a newly issued e-invoice.
 * Debit Accounts Receivable (1200), Credit Sales Revenue (4000) & SST Payable (2200).
 */
export async function postInvoice(data: {
  merchantId:   string;
  invoiceId:    string;
  subtotal:     number;
  tax:          number;
  total:        number;
  date:         Date;
}) {
  const accts = await getSystemAccountsByMerchant(data.merchantId);

  if (!accts.RECEIVABLES || !accts.SALES_REVENUE || !accts.SST_PAYABLE) {
    throw new Error(`Required accounts (AR/Revenue/SST) missing for merchant ${data.merchantId}`);
  }

  const lines: JournalLineInput[] = [
    { 
      accountId: accts.RECEIVABLES, 
      debit:     data.total, 
      credit:    0, 
      description: 'Customer Owed' 
    },
    { 
      accountId: accts.SALES_REVENUE, 
      debit:     0, 
      credit:    data.subtotal, 
      description: 'E-Invoice Revenue' 
    },
    { 
      accountId: accts.SST_PAYABLE, 
      debit:     0, 
      credit:    data.tax, 
      description: 'SST on E-Invoice' 
    },
  ];

  return await insertJournalEntry({
    merchantId:  data.merchantId,
    date:         data.date,
    description: `e-Invoice Issued — ${data.invoiceId}`,
    sourceType:  'INVOICE',
    sourceRef:    data.invoiceId,
    lines,
  });
}

/**
 * Automates journal entry creation for expenses.
 */
export async function postExpense(data: {
  merchantId: string;
  expenseId:  string;
  vendor:      string;
  amount:      number;
  taxAmount:   number;
  category:    string;
  date:        Date;
  paymentMethod?: string;
  paymentAccountId?: string;
}) {
  const accts = await getSystemAccountsByMerchant(data.merchantId);

  // Map category to account code
  const CATEGORY_MAP: Record<string, string> = {
    'utilities': '6300',
    'office_supplies': '6000',
    'rent_premises': '6200',
    'marketing_advertising': '6400',
    'professional_services': '6000',
    'software_subscriptions': '6000',
    'insurance': '6000',
    'repairs_maintenance': '6000',
    'postage_courier': '6600',
    'bank_charges': '6500',
    'staff_hr': '6100',
    'raw_materials_inventory': '5000',
    'transportation_vehicle': '6000',
    'meals_entertainment': '6000',
    'equipment_hardware': '1800',
    'other': '6000',
  };

  const expenseCode = CATEGORY_MAP[data.category] || '6000';
  const expenseAccountId = accts.raw[expenseCode] || accts.raw['6000'];

  if (!expenseAccountId || !accts.CASH_BANK) {
    throw new Error(`Required accounts for expense posting missing for merchant ${data.merchantId}`);
  }

  const lines: JournalLineInput[] = [
    // 1. Expense: The actual cost (Debit)
    { 
      accountId: expenseAccountId, 
      debit: data.amount - data.taxAmount, 
      credit: 0, 
      description: `${data.vendor} - ${data.category}` 
    },
    // 2. Asset: Cash/Bank (Money going out) (Credit)
    { 
      accountId: data.paymentAccountId || accts.CASH_BANK, 
      debit: 0, 
      credit: data.amount, 
      description: `Payment for ${data.vendor}` 
    }
  ];

  // 3. Optional: Tax (Debit) if applicable
  if (data.taxAmount > 0) {
    // In many cases this is just part of expense unless SST is claimable
    // For now we assume typical SME where SST is part of cost unless specified
    // But if we have an INPUT TAX account, we could use it here.
  }

  return await insertJournalEntry({
    merchantId:  data.merchantId,
    date:         data.date,
    description: `Expense Recorded — ${data.vendor}`,
    sourceType:  'EXPENSE',
    sourceRef:    data.expenseId,
    lines,
  });
}

/**
 * Automates journal entry for goods received in procurement.
 * Debit Inventory (1300), Credit Accounts Payable (2100).
 */
export async function postProcurementReceipt(data: {
  merchantId: string;
  poId:       string;
  poNumber:   string;
  supplier:   string;
  total:      number;
  date:       Date;
}) {
  const accts = await getSystemAccountsByMerchant(data.merchantId);

  if (!accts.INVENTORY || !accts.PAYABLES) {
    throw new Error(`Required accounts (Inventory/Payables) missing for merchant ${data.merchantId}`);
  }

  const lines: JournalLineInput[] = [
    { 
      accountId: accts.INVENTORY, 
      debit:     data.total, 
      credit:    0, 
      description: `Goods received — PO ${data.poNumber}` 
    },
    { 
      accountId: accts.PAYABLES, 
      debit:     0, 
      credit:    data.total, 
      description: `Liability to ${data.supplier}` 
    }
  ];

  return await insertJournalEntry({
    merchantId:  data.merchantId,
    date:         data.date,
    description: `Procurement Receipt — ${data.poNumber} from ${data.supplier}`,
    sourceType:  'PROCUREMENT',
    sourceRef:    data.poId,
    lines,
  });
}

/**
 * Automates journal entry for procurement payments.
 * Debit Accounts Payable (2100), Credit Cash/Bank (1100).
 */
export async function postProcurementPayment(data: {
  merchantId: string;
  poId:       string;
  poNumber:   string;
  amount:     number;
  date:       Date;
  paymentMethod: string;
}) {
  const accts = await getSystemAccountsByMerchant(data.merchantId);

  if (!accts.PAYABLES || !accts.CASH_BANK) {
    throw new Error(`Required accounts (Payables/Cash) missing for merchant ${data.merchantId}`);
  }

  return await insertJournalEntry({
    merchantId:  data.merchantId,
    date:         data.date,
    description: `Procurement Payment — PO ${data.poNumber}`,
    sourceType:  'PROCUREMENT',
    sourceRef:    data.poId,
    lines: [
      { 
        accountId: accts.PAYABLES, 
        debit:     data.amount, 
        credit:    0, 
        description: `Reducing liability for PO ${data.poNumber}` 
      },
      { 
        accountId: accts.CASH_BANK, 
        debit:     0, 
        credit:    data.amount, 
        description: `Payment via ${data.paymentMethod}` 
      }
    ]
  });
}

/**
 * Automates journal entry for e-commerce or marketplace orders.
 * Handles Revenue, SST, Shipping Income, and COGS/Inventory.
 */
export async function postOrderSale(data: {
  merchantId: string;
  orderId:    string;
  orderNo:    string;
  total:      number;
  subtotal:   number;
  tax:        number;
  delivery:   number;
  discount:   number;
  cogs:       number;
  date:       Date;
  paymentMethod: string;
  isMarketplace?: boolean;
}) {
  const accts = await getSystemAccountsByMerchant(data.merchantId);

  if (!accts.SALES_REVENUE || !accts.CASH_BANK || !accts.SST_PAYABLE) {
    throw new Error(`Required accounts (Revenue/Cash/SST) missing for merchant ${data.merchantId}`);
  }

  const lines: JournalLineInput[] = [];

  // 1. Asset: Cash & Bank (Normal) or Receivables (Marketplace)
  // For marketplace, funds are held by the platform (Receivables) until released to bank.
  const assetAccountId = data.isMarketplace ? (accts.RECEIVABLES || accts.CASH_BANK) : accts.CASH_BANK;
  lines.push({
    accountId: assetAccountId,
    debit:     data.total,
    credit:    0,
    description: `Order Payment — ${data.paymentMethod}${data.isMarketplace ? ' (via Platform)' : ''}`
  });

  // 2. Revenue: Sales Revenue (Subtotal)
  lines.push({
    accountId: accts.SALES_REVENUE,
    debit:     0,
    credit:    data.subtotal,
    description: `Order Revenue — ${data.orderNo}`
  });

  // 3. Revenue: Shipping Fees (Credit)
  if (data.delivery > 0) {
    lines.push({
      accountId: accts.SALES_REVENUE,
      debit:     0,
      credit:    data.delivery,
      description: 'Shipping Fees Collected'
    });
  }

  // 4. Liability: SST Payable (Credit)
  if (data.tax > 0) {
    lines.push({
      accountId: accts.SST_PAYABLE,
      debit:     0,
      credit:    data.tax,
      description: 'Tax (SST) on Order'
    });
  }

  // 5. COGS & Inventory (if COGS tracking is enabled)
  if (data.cogs > 0 && accts.COGS && accts.INVENTORY) {
    lines.push(
      { accountId: accts.COGS,      debit: data.cogs, credit: 0,           description: 'Cost of Goods Sold' },
      { accountId: accts.INVENTORY, debit: 0,           credit: data.cogs,  description: 'Inventory reduction' }
    );
  }

  return await insertJournalEntry({
    merchantId:  data.merchantId,
    date:         data.date,
    description: `Order Sale — ${data.orderNo}`,
    sourceType:  'ORDER',
    sourceRef:    data.orderId,
    lines,
  });
}
