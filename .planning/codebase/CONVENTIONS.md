# Coding Conventions

## Language & Tooling
- **TypeScript**: Mandatory for all new code. Use strict mode.
- **Linting**: ESLint (Next.js defaults).
- **Formatting**: Standard Prettier settings.

## Frontend Patterns
- **Next.js App Router**: Use `(grouping)` for logical route separation.
- **Server Components**: Default to Server Components for data fetching.
- **Client Components**: Use `"use client"` only when interactivity (hooks, event listeners) is required.
- **Server Actions**: Use `"use server"` in `actions.ts` files for all mutations.
- **State Management**: Use Zustand for complex client-side state. Use URL params for filter/sort state when possible.
- **Components**: Prefer Shadcn UI components. Use `lucide-react` for icons.

## Backend & Data Patterns
- **Supabase**: Use the `@supabase/ssr` package for auth and data access.
- **RLS (Row Level Security)**: Always include `merchant_id` filters in queries even though RLS is active (belt and braces).
- **Accounting Integrity**: All financial movements must post to the `@project1/accounting` engine journal.
- **Database Naming**: 
  - Tables and columns: `snake_case` (PostgreSQL standard).
  - TypeScript interfaces/types: `PascalCase` or `camelCase`.

## AI Integration
- **Structured Outputs**: Use Zod schemas with the AI SDK to ensure structured data extraction.
- **Context Injection**: Always inject relevant business context (merchant type, store name) into AI prompts to improve accuracy.

## Error Handling
- **Server Actions**: Catch errors and throw informative messages or return error objects.
- **Client Side**: Use `react-hot-toast` for user-facing error notifications.
