# Phase 4 Context: Onboarding & Educational UX

## Objective
Reduce the learning curve for non-expert merchants by providing interactive guidance and "Socratic" accounting help throughout the dashboard.

## Key Features

### 🏁 Guided Terminal Tour
- **Scope:** Interactive tour of the POS terminal.
- **Trigger:** First time a merchant opens the POS.
- **Steps:**
  1. Setting up your Terminal name.
  2. Opening a Session (Cash in Drawer).
  3. Making your first sale.
  4. Closing & Reconciliation (The Z-Report).

### 📖 Context-Aware "Accounting Guides"
- **Scope:** In-page widgets that explain "The Why" behind accounting actions.
- **Location:** Inventory, Expenses, and Journal pages.
- **Example:** On the Expenses page, a guide explains: *"When you record an expense, the system automatically subtracts from your Cash account and adds to your Expense ledger. This keeps your P&L accurate without you needing to know Debits or Credits."*

### 🛠️ Setup Wizard
- **Scope:** A checklist for new accounts.
- **Tasks:**
  1. Upload business logo.
  2. Define Tax (SST) rate.
  3. Create first product.
  4. Start first POS session.

## Tech Stack
- **Guided Tours:** Implement using a lightweight React-based tour library or a custom Overlay component for maximum UI control.
- **Guides:** Use the existing `AccountingGuide.tsx` component and expand it.

## Technical Tasks
1. Create `OnboardingTour` component.
2. Implement "First Time" flag in `profiles` or `merchants` table.
3. Add `AccountingGuide` sections to Procurement and POS.
