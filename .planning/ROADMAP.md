# Roadmap (v1.0)
 
## Milestone 1: Stabilization & Operational Core
 
### Phase 1: Project Initialization & Health
- [x] **Phase 1: Project Initialization & Health**
**Goal**: Initialize project state and verify codebase health.
- Setup GSD workflow automation.
 
### Phase 2: POS Session & Financial Integrity
- [x] **Phase 2: POS Session & Financial Integrity**
**Goal**: Implement robust Start/End session workflows in POS.
- Fix any RLS policy issues in accounting tables.
- Ensure automated journal postings for all transactions.
 
### Phase 3: Intelligent Procurement
- [x] **Phase 3: Intelligent Procurement**
**Goal**: Finalize AI extraction for Purchase Orders.
**Depends on**: Phase 2
- Fix supplier data display and automated linking.
 
## Milestone 2: User Experience & Deep Automation
 
### Phase 4: Onboarding & Educational UX
- [x] **Phase 4: Onboarding & Educational UX**
**Goal**: Implement guided tours for new merchants.
**Depends on**: Phase 1
- Create context-aware "Accounting Guides" and setup wizards.
 
### Phase 5: Advanced Automation Agents
- [x] **Phase 5: Advanced Automation Agents**
**Goal**: Enhance AI expense classification accuracy.
**Depends on**: Phase 3
- Implement automated stock alerts and low-inventory reordering.
 
## Milestone 3 (Current): Compliance & Market Rollout (v1.0)
 
### Phase 6: Malaysian E-Invoicing (MyInvois)
- [x] **Phase 6: Malaysian E-Invoicing (MyInvois)**
**Goal**: Full rollout of LHDN MyInvois integration.
**Depends on**: Phase 2
- Automated SST-02 reporting and filing preparation.
 
### Phase 7: Audit-Ready Finance & Scale
- [ ] **Phase 7: Audit-Ready Finance & Scale**
**Goal**: Implement bank reconciliation and immutable audit logs.
**Depends on**: Phase 6
- Production build optimization and deployment scaling.
 
### Phase 8: POS Profile & Account Sovereignty
- [x] **Phase 8: POS Profile & Account Sovereignty** (completed 2026-04-09)
**Goal**: Make "My Profile" and "Account Settings" fully functional and integrated within the POS.
**Depends on**: Phase 1
- Integrated profile management (Avatar, Name, Security).
- Business-level account settings accessible from POS.
### Phase 9: POS UI & Performance Optimization
- [x] **Phase 9: POS UI & Performance Optimization** (completed 2026-04-10)
**Goal**: Improve POS and Merchant Dashboard performance (fix menu reloading issue).
**Depends on**: Phase 8
- Implement SWR (Stale-While-Revalidate) for POS products.
- URL-sync for category and search filters.
- Background sync indicator.


---

---

 
## Backlog
- 999.1: Mobile app for merchants (iOS/Android)
- 999.2: Direct payment gateway integrations (FPX, Cards)
- 999.3: Payroll automation module
