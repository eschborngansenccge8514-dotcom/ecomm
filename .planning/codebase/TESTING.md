# Testing Strategy

## Overview
The project currently relies on a mixture of manual verification, operational scripts, and targeted service tests.

## Test Types
- **Unit/Integration Tests**: Primarily found in `__tests__` directories (e.g., in `apps/einvoice-service`).
- **Operational Scripts**: Many modules include `test-*.ts` or `test-*.js` files in their root for verifying specific flows like AI extraction, database connectivity, or third-party integrations (e.g., `packages/agent/test-runAgent.ts`).
- **Manual Verification**: The comprehensive Dashboard UI and Supabase RLS policies are typically verified through manual user testing in the dev environment.

## Key Tools
- **Supertest**: Used for API testing in `apps/einvoice-service`.
- **Manual Scripts**: Run via `tsx` or `ts-node` to verify standalone logic.

## Recommended Practices
1. **New Features**: Implement a corresponding `test-*.ts` script to verify logic before merging.
2. **Critical Logic**: For accounting or financial logic, add formal Vitest or Jest units (planned).
3. **Database**: Use the scripts in `apps/einvoice-service/scripts/` to setup test data.
