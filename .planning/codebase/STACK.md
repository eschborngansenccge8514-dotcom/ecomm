# Tech Stack

## Core Technologies
- **Main Framework**: Next.js 16 (Canary)
- **UI Architecture**: React 19 (Server Components, Client Components)
- **Language**: TypeScript
- **Package Manager**: pnpm (Workspace Monorepo)

## Database & Persistence
- **Primary Database**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM
- **Authentication**: Supabase Auth (with SSR integration)
- **Storage**: Supabase Storage

## Frontend & Styling
- **Styling**: Tailwind CSS 4
- **Component Library**: Radix UI (Headless), Shadcn UI
- **State Management**: Zustand, React Hooks
- **Forms**: React Server Actions, Zod for validation
- **Tables**: TanStack Table
- **Charts**: Recharts

## AI & Intelligence
- **SDK**: Vercel AI SDK (@ai-sdk/google, ai)
- **Models**: Google Gemini 2.0 Flash (implied by recent conversation history and @ai-sdk/google)

## Infrastructure
- **Deployment**: Vercel (implied by .vercel directory and .env.vercel)
- **Database Hosting**: Supabase
- **E-Invoicing**: Custom service (apps/einvoice-service)

## Testing (Inferred)
- **Linting**: ESLint (Next.js config)
- **Formatting**: (Likely Prettier, standard for such stacks)
