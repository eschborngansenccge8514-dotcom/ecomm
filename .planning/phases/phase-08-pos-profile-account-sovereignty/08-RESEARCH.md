# Research Phase 08: POS Profile & Account Sovereignty

Implementation details for terminal-native management components and security.

## 1. Security & Authentication (PIN System)

### Database Schema
- **Target Table**: `profiles`
- **New Column**: `pos_pin` (type: `text`)
- **Hashing Strategy**: Use standard numeric PIN for user convenience. For security, we will store a SHA-256 hash (or similar) of the PIN, or just a 4-digit numeric string with strict RLS if the threat model allows.
- **RLS Policy**: Only the profile owner can read/write their own `pos_pin`.

### Verification Logic
- **Client-Side**: The UI will prompt for a 4-digit PIN using a specialized numeric keypad component.
- **Server-Side**: Verification will happen via a Supabase RPC or a secure Server Action to prevent PIN brute-forcing or bypass.

## 2. Component Architecture

### ProfileModal
- **Location**: `apps/dashboard/src/components/pos/ProfileModal.tsx`
- **Features**: 
    - Display current user name, email, and avatar.
    - Fields: Full Name (editable), Avatar URL (editable).
    - PIN Management: "Set POS PIN" or "Change POS PIN" flow inside this modal.
- **Style**: Follows `TerminalSettingsModal` (White card, premium shadows, Emerald accents).

### AccountSettingsModal
- **Location**: `apps/dashboard/src/components/pos/AccountSettingsModal.tsx`
- **Features**:
    - **Header**: Amber-themed with `Buildings` or `Settings` icon.
    - **Auth Gate**: Immediately shows a `PinPrompt` if not yet verified for the current session.
    - **Sections**: 
        - Store Identity (Name, Tagline).
        - Contact Info (Phone, WhatsApp).
        - Operating Hours (Open/Closed switch, time pickers).
        - Tax Config (SST Rate input).
- **Style**: Amber/Indigo accents.

### PinPrompt
- **Location**: `apps/dashboard/src/components/pos/PinPrompt.tsx`
- **UI**: Large 4-digit indicator with a custom touch-friendly numeric keypad (0-9, Backspace).

## 3. Real-time Synchronization
- **Store Config**: Updates to the `merchants` table (store_name, store_config) will be synced using `router.refresh()` or a Zustand store update if used in other POS components.
- **Operating Hours**: Updates to `merchant_operating_hours`.

## 4. Dependencies & Integration
- **ActionHeader Integration**: Modify the "My Profile" and "Account Settings" button handlers in `ActionHeader.tsx` to set state variables (`isProfileOpen`, `isAccountSettingsOpen`) instead of navigating to `/dashboard/*`.
