# Phase Context - Phase 08: POS Profile & Account Sovereignty

Integrating "My Profile" and "Account Settings" directly into the POS experience to eliminate jarring dashboard redirects and empower operators with terminal-native business management.

## Domain Boundary
Everything related to managing user identity (Profile) and business configuration (Settings) within the POS terminal interface (`/pos`).

## Canonical Refs
- [ROADMAP.md](file:///Users/jj/Downloads/project1/.planning/ROADMAP.md)
- [ActionHeader.tsx](file:///Users/jj/Downloads/project1/apps/dashboard/src/components/pos/ActionHeader.tsx)
- [ProfileClient.tsx](file:///Users/jj/Downloads/project1/apps/dashboard/src/components/dashboard/ProfileClient.tsx)
- [SettingsClient.tsx](file:///Users/jj/Downloads/project1/apps/dashboard/src/components/dashboard/SettingsClient.tsx)

## Decisions

<decisions>

### 1. Integration Pattern: Integrated Modal System
- **Decision**: Replace dashboard redirects with high-performance modal overlays.
- **Rationale**: Maintain POS session state and provide a frictionless, "terminal-native" experience.
- **Implementation**: 
    - Create `ProfileModal.tsx` and `AccountSettingsModal.tsx` in `components/pos/`.
    - These modals will use the `usePosSettings` and existing server actions/Supabase logic but with a tailored UI.

### 2. Settings Scope: High-Frequency Subset
- **Decision**: Only expose settings relevant to daily operations in the POS.
- **Included Fields**:
    - **Identity**: Store Name, Tagline.
    - **Contact**: Business Phone, WhatsApp (crucial for order coordination).
    - **Operations**: Current Operating Hours (Open/Closed toggle), SST Tax Rate.
    - **Location**: Store Address and Lat/Lng (for delivery radius).
- **Deferred**: Logistics provider config (Lalamove/EasyParcel API keys), Payment provider config (Razorpay/Billplz), and E-Invoice registration stay in the main Dashboard for security and complexity reasons.

### 3. Visual Aesthetic: POS Premium Theme
- **Decision**: Adopt the POS design system (vibrant, high-contrast, dark mode) for these modals.
- **Style**: Black backgrounds, emerald/amber accents, large touch-friendly inputs, and glassmorphism effects.
- **Consistency**: Ensures the terminal feels like a single, cohesive "Operating System" rather than a web app.

### 4. Security: Inline PIN Authorization
- **Decision**: Guard "Account Settings" with an inline PIN prompt.
- **Behavior**:
    - "My Profile" is accessible freely to the logged-in user.
    - "Account Settings" triggers a 4-digit PIN overlay.
    - PIN is stored securely in the `profiles` table (new column `pos_pin`).
- **Safety**: Prevents unauthorized staff from changing tax rates or store status during a shift.

</decisions>

## Specifics

<specifics>
- **PIN Management**: Users should be able to set/reset their POS PIN from the "My Profile" modal.
- **Real-time Sync**: Changes to Operating Hours or Store Name should reflect immediately in the POS UI (using Supabase Realtime or `router.refresh()`).
</specifics>

## Deferred

<deferred>
- **Multi-Terminal PINs**: Individual PINs per terminal instance. (Currently one PIN per user/merchant).
- **Full Settings Port**: Bringing all Logistics/Payment configs into POS. (Dashboard only for now).
</deferred>
