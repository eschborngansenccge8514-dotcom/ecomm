<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# rewrite the earlier full plan into a Phase 2 plan only

Yes — here is the earlier plan rewritten as a **Phase 2 plan only**, assuming your Direct API Integration is already live and stable. The goal of this phase is to add a user-friendly consolidated e-Invoice workflow on top of your existing MyInvois connection, with rules that match LHDN’s consolidation requirements.[^1]

## Phase 2 scope

This phase should cover only the business layer above your current API: receipt capture, eligibility logic, buyer request handling, consolidated document generation, month-end submission, and exception management.[^1]
You do not need to rebuild authentication, document submission, status polling, or basic MyInvois connectivity, because those are already part of your live Direct API setup.

**Phase 2 objective:** turn eligible receipts into either an individual e-Invoice or a monthly consolidated e-Invoice with minimal user decisions and clear compliance guardrails.[^1]
**Best starting point:** B2C and walk-in transactions first, because that is usually where consolidation gives the biggest operational gain.[^1]

## Functional design

The user flow should stay simple: create receipt, wait for buyer request window, auto-classify as individual or consolidated, submit at month end, then monitor validation and archive.[^1]
Your finance users should not see technical API language; they should only see business statuses such as “Receipt recorded,” “Waiting for buyer request,” “Ready for consolidation,” “Submitted,” and “Validated.”[^1]

Build these six features first:

- **Receipt staging area** — Every eligible sale lands here first instead of going straight to e-Invoice submission, because consolidated e-Invoice depends on whether the buyer requests an individual document within the same month.[^1]
- **Buyer request capture** — Add a simple button or form for staff to mark “Buyer requested e-Invoice,” since buyers may request an individual e-Invoice within the month of transaction.[^1]
- **Eligibility rules engine** — The system should decide automatically whether a transaction stays in the staging pool, becomes an individual e-Invoice, or is blocked from consolidation due to amount or activity type.[^1]
- **Consolidated builder** — This should auto-fill buyer details for consolidated e-Invoice using “General Public,” TIN `EI00000000010`, and `NA` where required, so users do not key these fields manually.[^1]
- **Receipt reference assembler** — The description should include the receipt references used in the consolidated e-Invoice, because LHDN requires those references to be included.[^1]
- **Month-end scheduler** — The system should generate and submit consolidated e-Invoices within 7 calendar days after month end.[^1]


## Rules engine

Your rules engine is the most important part of Phase 2, because it prevents invalid transactions from being consolidated.[^1]
The logic should be automatic and visible in plain language so staff understand why the system made each decision.[^1]

Use this decision table:


| Condition | System decision |
| :-- | :-- |
| Buyer asks for e-Invoice during sale or within the same month | Issue individual e-Invoice. [^1] |
| Buyer does not ask, transaction is RM10,000 or below, and activity is eligible | Keep in consolidation pool. [^1] |
| Single transaction exceeds RM10,000 | Force individual e-Invoice. [^1] |
| Transaction belongs to restricted activity where consolidation is not allowed | Force individual e-Invoice. [^1] |
| Month-end cut-off passed and receipt is still eligible | Include in consolidated e-Invoice batch. [^1] |

For user-friendliness, every blocked case should show a human message such as **“Cannot consolidate: amount exceeds RM10,000”** or “Cannot consolidate: buyer requested individual e-Invoice.”[^1]
That will reduce support questions and help outlet staff make decisions quickly without reading the guideline itself.[^1]

## User features

The interface should focus on speed, clarity, and low training effort, especially if non-finance staff enter receipts. This means fewer manual fields, more defaults, and clear action buttons tied to business language rather than tax terminology.

Plan these user-facing features:

- **One-click receipt classification** — Staff should be able to record a sale and let the system default it to “Awaiting buyer request” without choosing document type upfront.
- **Buyer request pop-up** — If a customer asks for an e-Invoice, staff should click one button, search the receipt, and convert it immediately into an individual e-Invoice.
- **Month-end review screen** — Finance should see grouped receipts by branch, date, and range before submission, with a simple approve-and-submit action.
- **Exception queue** — Keep separate lists for “Above threshold,” “Restricted activity,” “Missing data,” and “Late buyer request,” so users know what needs manual follow-up.
- **Branch view** — If you have multiple outlets, let each branch review its own pending consolidated pool, since LHDN allows branch or location-based grouping.[^1]
- **Deadline tracker** — Show how many days remain before the 7-day submission deadline after month end.[^1]

My suggestion is to make the month-end review screen the main workspace for finance, because that is where most real decisions happen. For outlets or front-desk teams, keep the workflow limited to only two actions: record receipt and mark buyer request.

## Delivery roadmap

Implement Phase 2 in three short releases so you reduce risk and keep operations running during rollout. The compliance-sensitive parts are the eligibility rules, buyer request cut-off, and month-end submission deadline, so those should come before analytics or reporting extras.[^1]


| Release | Scope | Main users |
| :-- | :-- | :-- |
| **2A** | Receipt staging, buyer request capture, eligibility rules, user messages | Outlet staff, operations |
| **2B** | Consolidated builder, receipt reference assembly, branch grouping, month-end scheduler, submission workflow | Finance team |
| **2C** | Dashboard, exception queue, deadline alerts, audit logs, branch performance view | Finance manager, admin |

Suggested rollout order:

- Start with one branch or one transaction type, preferably walk-in B2C sales.
- Run one parallel month where staff use the new staging flow but finance still reviews outputs manually before submission.
- Only enable full auto-grouping after you confirm threshold rules, exclusions, and buyer-request handling are correct.
- Lock the cut-off policy clearly, for example: “Buyer requests accepted until 11:59 PM on the last day of the transaction month.”

A practical decision checklist for this phase is:

- [ ] Define which transactions are eligible for consolidation.
- [ ] List all restricted activity types in your business.
- [ ] Decide branch-based vs receipt-range grouping method.
- [ ] Set the buyer request cut-off process.
- [ ] Decide who approves month-end consolidated submissions.
- [ ] Design user messages for blocked or late cases.
- [ ] Test one full month-end cycle before full rollout.

<div align="center">⁂</div>

[^1]: https://www.cleartax.com/my/en/different-phases-implementation-timelines-einvoicing-malaysia

