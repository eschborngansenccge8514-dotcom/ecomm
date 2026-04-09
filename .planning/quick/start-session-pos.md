# Quick Task: Missing Start Session in POS

The objective is to allow users to manually start a POS session from the header menu, especially when no session is active.

## Proposed Changes

### 1. `apps/dashboard/src/components/pos/ActionHeader.tsx`
- Add `onStartSession` to `ActionHeaderProps`.
- In the quick menu dropdown, if `!sessionId`, show a "Start Session" button that calls `onStartSession`.
- Change the `End Session` button logic to only show when `sessionId` exists, or keep it disabled and show `Start Session` above/below it.
- Better: Replace "End Session" with "Start Session" if no session exists.

### 2. `apps/dashboard/src/app/(pos)/pos/page.tsx`
- Pass `() => setIsStartSessionOpen(true)` as `onStartSession` prop to `ActionHeader`.

### 3. `apps/dashboard/src/components/pos/StartSessionModal.tsx`
- Add a close button (optional but good for UX if triggered from menu).
- However, if the session is required to do anything, maybe keep it forced.
- Let's add a close button so it can be dismissed if opened from the menu.

## Verification Plan
1. Go to POS page without an active session.
2. Observe if the "Start Session" modal appears (it should).
3. If dismissed (if we add close button) or if already closed, open the Menu and see if "Start Session" is available.
4. Click "Start Session" and ensure the modal opens.
