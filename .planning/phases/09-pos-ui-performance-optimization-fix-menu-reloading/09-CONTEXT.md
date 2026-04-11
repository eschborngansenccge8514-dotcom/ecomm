# Phase Context - Phase 09: POS UI & Performance Optimization

Optimizing the merchant dashboard and POS terminal for "Instant-On" performance and reduced database overhead.

## Domain Boundary
Frontend state management, caching strategies, and navigation persistence for the POS (`/pos`) and Dashboard modules.

## Canonical Refs
- [ROADMAP.md](../../ROADMAP.md)
- [PosPage.tsx](../../../apps/dashboard/src/app/(pos)/pos/page.tsx)
- [pos-offline.ts](../../../apps/dashboard/src/stores/pos-offline.ts)
- [pos-actions.ts](../../../apps/dashboard/src/lib/pos-actions.ts)

## Decisions

<decisions>

### 1. Caching Strategy: Persistent SWR (Stale-While-Revalidate)
- **Decision**: Use the `usePosOffline` persisted store as the primary UI source.
- **Implementation**:
    - `PosPage` initializes `products` state with `cachedProducts`.
    - `isLoading` is `false` if `cachedProducts.length > 0`.
    - `useEffect` triggers a background fetch that updates the store and local state silently.
- **Benefit**: Zero-latency menu rendering on "Back" navigation or app restart.

### 2. Navigation State: URL-Based Filtering
- **Decision**: Synchronize POS filters (category, search, pagination) to the URL.
- **Implementation**: 
    - Use `useSearchParams` and `useRouter` to push/replace state.
    - `init()` in `PosPage` reads filters from searchParams.
- **Benefit**: Clicking "Back" from checkout or receipt perfectly restores the user's filtered view.

### 3. Execution: Optimistic Cart & Session Actions
- **Decision**: Remove blocking spinners for high-frequency actions.
- **Scope**:
    - "Add to Cart": Immediate increment in UI.
    - "Start Session": Immediate transition to menu while DB call runs.
- **Fallback**: Robust toast-based error reporting with retry options for failed background syncs.

### 4. Visibility: Subtle Background Sync Indicator
- **Decision**: Pulsating indicator in the `ActionHeader`.
- **UI**: Small emerald dot (syncing) turning static when idle.
- **Rationale**: Keeps the user informed about data freshness without jarring UI blocks.

</decisions>

## Specifics

<specifics>
- **Cache TTL**: Set a 5-minute threshold for "Stale" data. If cache is < 5 mins old, skip background refetch unless explicitly pulled.
- **Scroll Position**: Ensure `ProductGrid` scroll position is preserved when navigating back.
</specifics>

## Deferred
- **Web Worker Sync**: Offloading sync logic to a Web Worker for massive catalogs (>10k SKUs).
- **Service Worker Product Caching**: Full PWA product image caching.
