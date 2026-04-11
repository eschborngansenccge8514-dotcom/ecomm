# Phase Plan - Phase 09: POS UI & Performance Optimization

Improving the merchant dashboard and POS terminal performance by implementing SWR caching patterns and state persistence.

## Objectives
- Eliminate loading flickers during POS navigation.
- Reduce database load via intelligent caching.
- Ensure UI state (filters) is preserved across page navigations.
- Implement optimistic session lifecycle.

## Tasks

### Task 1: Store Enhancement
- [ ] **1.1. Update `OfflineState` interface** in `apps/dashboard/src/stores/pos-offline.ts`.
    - Add `isSyncing: boolean`.
    - Add `lastSyncedAt: number | null`.
- [ ] **1.2. Update `usePosOffline` actions**.
    - Implement `setSyncing(isSyncing: boolean)`.

### Task 2: Refactor POS Page (SWR & URL States)
- [ ] **2.1. Refactor Filter State to URL** in `apps/dashboard/src/app/(pos)/pos/page.tsx`.
    - Replace `useState` for `searchQuery` and `category` with URL-based derivation using `useSearchParams`.
    - Implement debounced URL updates for search to prevent excessive history entries.
- [ ] **2.2. Refactor Initialization to SWR** in `apps/dashboard/src/app/(pos)/pos/page.tsx`.
    - Initial `products` state should use `cachedProducts` from `usePosOffline`.
    - `isLoading` should be `false` if cache exists.
    - `init()` should run silently in the background if cache is present, updating the store.
    - Implement a 5-minute sync threshold (don't refetch if `lastSyncedAt` is recent).

### Task 3: UI Polish & Feedback
- [ ] **3.1. Add Sync Indicator** to `apps/dashboard/src/components/pos/ActionHeader.tsx`.
    - Subscribe to `isSyncing` from `usePosOffline`.
    - Display a small pulsating dot or subtle text.
- [ ] **3.2. Optimistic Session Start**.
    - Update `StartSessionModal.tsx` to call `setSession` immediately and close the modal, while the server action runs in background.

## Verification Plan

### Automated Tests
- N/A (Manual UAT preferred for UI performance).

### Manual UAT (Verification Prompts)
1. **Instant Menu**: Navigate from `/pos` to `/pos/checkout` and click the browser "Back" button. The menu should appear instantly without a loading skeleton.
2. **Filter Persistence**: Set category to "Drinks" and search for "Coffee", then navigate away and back. The filters should be preserved in the URL and the UI.
3. **Background Sync**: Check that the "Syncing" indicator appears briefly when the app detects stale data, but doesn't block interaction.
4. **Session Start**: Clicking "Start Session" should instantly show the products (from cache) while the session is established in the background.
