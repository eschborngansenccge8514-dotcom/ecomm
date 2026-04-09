# Technical Concerns

## 1. Multi-Tenant Security (Critical)
- **Risk**: Data leaking between merchants.
- **Mitigation**: Strictly maintain Supabase RLS policies. Always verify `merchant_id` in Server Actions and filters. Ensure all new tables have proper RLS.

## 2. Accounting Integrity
- **Risk**: Desynchronization between operational data (expenses, sales) and the accounting ledger.
- **Mitigation**: Use transactional posting in the `@project1/accounting` engine. Ensure all confirmed actions trigger a corresponding journal entry. Implement a reconciliation task for edge cases.

## 3. AI Reliability & Latency
- **Risk**: Receipt extraction or agent actions failing or returning incorrect data, leading to user frustration.
- **Mitigation**: Implement confidence score monitoring. Always allow manual overrides. Log AI inputs/outputs for debugging extraction failures.

## 4. Compliance (LHDN/SST)
- **Risk**: Incorrect tax reporting for Malaysian SST or failed MyInvois (e-invoicing) submissions.
- **Mitigation**: Maintain strict audit trails for all submissions. Keep the `einvoice-service` updated with the latest LHDN SDK/API changes.

## 5. Deployment Complexity
- **Risk**: Monorepo build times and cross-package dependency issues.
- **Mitigation**: Use pnpm workspaces effectively. Optimize Next.js builds. Ensure clear boundaries between `packages/`.
