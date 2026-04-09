# Project Structure

## Root Directory
- `/apps/`: High-level applications
- `/packages/`: Shared libraries and core modules
- `/supabase/`: Database migrations, seed data, and configuration
- `pnpm-workspace.yaml`: Workspace configuration
- `package.json`: Root dependencies and scripts

## /apps/ (Applications)
- `dashboard/`: The main Next.js 16 administration portal
  - `src/app/`: Next.js App Router folders (grouped by route groups like `(dashboard)`, `(public)`, `(auth)`)
  - `src/components/`: Shared UI components (Shadcn UI)
  - `src/lib/`: App-specific utility functions and actions
  - `src/stores/`: Zustand state management stores
- `einvoice-service/`: Specialized service for tax compliance
- `website/`: Marketing landing pages

## /packages/ (Shared Libraries)
- `accounting/`: Ledger, journal, and tax computation engine
- `agent/`: AI-driven features and agentic workflows
- `db/`: Drizzle ORM schemas and DB client
- `domain/`: Business entities, interfaces, and constant definitions
- `integrations/`: Adapters for Shopee, Lazada, TikTok, Lalamove, etc.

## /supabase/ (Data Layer)
- `migrations/`: Version-controlled SQL migration scripts
- `seed/`: Initial data for development and testing
- `config.toml`: Supabase CLI configuration
