# Phase Research - Phase 09: POS UI & Performance Optimization

## Domain Analysis
The POS terminal is a high-frequency interaction point. The current implementation in `PosPage.tsx` uses a heavy `useEffect` that triggers a full refetch on mount, leading to visible loading states every time a user navigates back to the page.

## Exploration Results

### 1. Persistent Store Analysis (`pos-offline.ts`)
- The `usePosOffline` store already implements `persist` (localStorage).
- `cachedProducts` is populated via `setCachedData` in `PosPage.tsx`.
- Currently, `cachedProducts` is only used as a fallback in the `catch` block.
- **Optimization**: We can move `cachedProducts` to the `initialState` of the `PosPage` component to allow instantaneous rendering.

### 2. URL State Sync
- Next.js `useSearchParams` and `useRouter` from `next/navigation` are present.
- We need to refactor `searchQuery` and `category` state to be derived from the URL.
- This ensures that browser "Back" navigation restores filters.

### 3. POS Actions (`pos-actions.ts`)
- `fetchPosProducts(outletId)` is a direct server action/Supabase call.
- We should add a timestamp check to `usePosOffline` to prevent redundant fetches if data is fresh.

### 4. Background Sync Indicator
- `ActionHeader.tsx` is the ideal place for a sync indicator.
- We can add a simple `isSyncing` state to `usePosOffline`.

## Conclusion & Recommendations
- **Pattern**: Refactor `PosPage` to "Load Cache First, Sync Later".
- **Interaction**: Use `router.replace` for filter updates to avoid polluting history with every keystroke (use a short debounce for search).
- **Optimization**: Deduplicate `getOrInitializeSession` and `fetchPosProducts` calls.
