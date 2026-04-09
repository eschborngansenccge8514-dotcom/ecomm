# Architecture

## System Overview
The project is a **Monorepo** structured using pnpm workspaces, designed for a multi-tenant ERP/E-commerce platform. It leverages a modern frontend-heavy stack with Supabase as the backend-as-a-service.

## Key Layers
1. **Frontend (Apps)**:
   - **Dashboard (Next.js)**: The primary admin interface. Uses App Router, Server Actions, and a mixture of Server and Client components.
   - **Website**: Public-facing marketing site.
   - **Merchant/Hyperlocal-app**: Specialized interfaces for specific user roles or use cases.

2. **Core Logic (Packages)**:
   - **@project1/domain**: Shared business logic and types.
   - **@project1/db**: Centralized database client and Drizzle schema definitions.
   - **@project1/accounting**: Specialized accounting engine logic (ledger, journal entries, tax calculations).
   - **@project1/integrations**: Shared adapters for 3rd party services.

3. **Backend Services (Supabase & External)**:
   - **PostgreSQL**: Hosted on Supabase with RLS (Row Level Security) for multi-tenancy.
   - **Supabase Auth**: Manages user identities and session flow.
   - **Functions Worker**: Background processing or edge functions.

## Patterns & Principles
- **Multi-tenancy**: Strictly enforced via Supabase RLS policies. Every table generally has a `merchant_id` or similar scope identifier.
- **Server-Side First**: Leveraging Next.js Server Components and Server Actions to minimize client-side bundle size and improve security.
- **Type Safety**: End-to-end TypeScript from database schema (Drizzle/Zod) to frontend components.
- **Modular Monorepo**: Separation of concerns into packages allows for shared logic across different apps while maintaining specialized service boundaries.
