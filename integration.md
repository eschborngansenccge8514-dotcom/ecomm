<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# You are a senior full-stack architect. Generate a complete, exhaustive implementation plan for phase 1. The plan must be detailed enough that a developer (or another AI) can execute each step without ambiguity. Every feature must be broken down to its smallest unit of work.

Below is a complete Phase 1 implementation plan that a developer can execute step by step without guessing. Phase 1 should build the **integration foundation only**: shared data model, tenant isolation, auth/token storage, job orchestration, webhook ingestion, product/order mapping primitives, observability, and the first channel connector scaffold, so later marketplace work becomes repeatable instead of custom. Supabase RLS, App Router cookie-based auth, scheduled Edge Functions, and webhook idempotency are the key platform primitives supporting this phase.[^1][^2][^3][^4]

## Phase 1 goal

Phase 1 ends when the platform can safely connect one tenant to one sandbox marketplace account, store credentials, ingest raw events, queue sync jobs, normalize external payloads into your canonical model, and replay failures deterministically. It does **not** need full marketplace completeness, but it must be production-shaped enough that Shopee, TikTok, Lazada, and Google Merchant can all plug into the same backend contract later. The result should be a reusable integration framework with strict tenant isolation and observability from day one.[^3][^4][^1]

## Deliverables

By the end of Phase 1, you should have:

- A canonical commerce schema in Supabase/Postgres.
- A marketplace integration schema with per-tenant credentials and mappings.
- RLS policies that isolate every tenant’s data.
- Authenticated merchant dashboard access using Next.js App Router and Supabase SSR cookie sessions.[^2]
- Edge Functions for auth callbacks, webhook ingestion, job execution, and health checks.
- A scheduled job runner using pg_cron to invoke sync workers.[^3]
- An idempotent event ingestion pattern for duplicate webhook protection.[^4]
- A unified error/retry/audit system.
- A marketplace connector interface with one implemented scaffold and three stub providers.


## Workstreams

### 1) Platform foundation

Build the shared commerce and integration foundation first. This includes schema design, tenancy boundaries, RLS, secrets handling, and audit tables. Nothing in the phase should talk directly to a marketplace without passing through this layer.

### 2) Backend execution model

Create a deterministic job system using Supabase Edge Functions plus scheduled invocations. Use database tables as the source of truth for job state, retries, and locks, so execution can be resumed and audited. Use pg_cron to trigger worker functions on a schedule.[^3]

### 3) Connector framework

Define a marketplace provider contract with normalized input/output objects. Each provider will eventually implement auth, product sync, order sync, inventory sync, and webhook parsing, but in Phase 1 only the framework and one working stub should exist.

### 4) Merchant dashboard shell

Build the dashboard surfaces needed to administer integration state. The UI should show connection state, validation errors, sync job history, raw payloads, and retry controls.

### 5) Observability and safety

Add logs, traces, metrics, error tables, and replay tooling. Duplicate events must be ignored safely using idempotency keys and unique constraints.[^4]

## Milestone 0: repository and architecture setup

### 0.1 Define the module boundaries

Create these top-level logical modules:

- `apps/merchant-dashboard`.
- `apps/hyperlocal-app`.
- `apps/edge-functions`.
- `packages/domain`.
- `packages/integrations`.
- `packages/db`.
- `packages/ui`.
- `packages/config`.
- `packages/observability`.

Each module must have a clear responsibility. The merchant dashboard owns admin UX, the customer app owns order tracking UX, Edge Functions own server-side marketplace operations, and shared packages own types and utilities.

### 0.2 Establish architectural conventions

Write an architecture decision record for each of the following:

- Canonical product model.
- Canonical order model.
- Tenant isolation strategy.
- Job processing pattern.
- Webhook idempotency strategy.
- Raw payload retention policy.
- Provider interface contract.
- Retry/backoff policy.
- Secret storage approach.


### 0.3 Set coding standards

Add linting, type-checking, formatting, and commit hooks. Enforce:

- TypeScript strict mode.
- No implicit `any`.
- Explicit nullability.
- No direct Supabase client usage outside approved libraries.
- No marketplace API calls from the UI layer.
- No direct SQL in UI code.


### 0.4 Define environment variables

Create a single source of truth for env vars:

- Supabase URL and anon key.
- Supabase service role key for server-side functions only.
- Marketplace app credentials placeholders.
- Encryption key for secret fields.
- Webhook signing secrets.
- Public app URLs.
- Cron invocation secret.
- Logging endpoint config if external logging is used.


## Milestone 1: canonical database design

### 1.1 Create tenancy tables

Implement the base tenant model:

- `tenants`.
- `users`.
- `tenant_memberships`.
- `tenant_roles`.
- `tenant_invites`.

Fields should include stable IDs, ownership, billing status, lifecycle status, timestamps, and soft-delete markers where needed.

### 1.2 Create identity and access tables

Add:

- `auth_identities`.
- `api_clients` if machine access is needed.
- `service_accounts` if background execution needs scoped identities.
- `role_permissions`.
- `membership_permissions`.

These tables should support merchant admins, operators, support staff, and automation identities.

### 1.3 Create core commerce tables

Add canonical commerce entities:

- `products`.
- `product_variants`.
- `product_images`.
- `product_categories`.
- `product_attributes`.
- `inventory_locations`.
- `inventory_levels`.
- `customers`.
- `orders`.
- `order_items`.
- `payments`.
- `fulfillments`.
- `shipments`.
- `returns`.
- `refunds`.
- `order_status_history`.

Each table must have `tenant_id`, timestamps, soft-delete policy where appropriate, and unique business keys where needed.

### 1.4 Create integration tables

Add the marketplace layer:

- `marketplace_providers`.
- `marketplace_accounts`.
- `marketplace_credentials`.
- `marketplace_authorization_states`.
- `marketplace_webhook_endpoints`.
- `marketplace_product_mappings`.
- `marketplace_variant_mappings`.
- `marketplace_order_mappings`.
- `marketplace_inventory_mappings`.
- `marketplace_sync_jobs`.
- `marketplace_sync_job_runs`.
- `marketplace_events`.
- `marketplace_event_dedup`.
- `marketplace_error_logs`.
- `marketplace_reconciliation_runs`.
- `marketplace_feature_flags`.


### 1.5 Define enums and constraints

Create explicit enums or lookup tables for:

- Account status.
- Sync job type.
- Sync job status.
- Event type.
- Order state.
- Fulfillment state.
- Error severity.
- Provider type.
- Region/site/country codes.

Add unique constraints for:

- One active marketplace account per tenant per provider per shop/site.
- One dedup row per provider event ID.
- One product mapping per tenant/provider/external listing ID.
- One variant mapping per tenant/provider/external SKU.


### 1.6 Add audit columns everywhere

Every mutable table must include:

- `created_at`.
- `updated_at`.
- `created_by`.
- `updated_by`.
- `deleted_at` if soft delete is used.
- `version` if optimistic concurrency is used.


### 1.7 Implement migration order

Sequence migrations as:

1. Base enums and utility functions.
2. Tenancy and access tables.
3. Core commerce tables.
4. Integration tables.
5. Indexes.
6. Constraints.
7. RLS enablement.
8. Seed data.

## Milestone 2: tenant isolation and security

### 2.1 Enable RLS on all tenant-scoped tables

Turn on Row Level Security for every table that stores tenant data. Supabase explicitly supports RLS as the standard way to secure Postgres data per row.[^1]

### 2.2 Write membership-based policies

Every policy should derive access from `tenant_memberships`. Required policy patterns:

- Select allowed if user belongs to tenant.
- Insert allowed only if `tenant_id` matches the user’s active tenant.
- Update allowed only if user has write permission.
- Delete allowed only if user has admin permission.
- Service role may bypass RLS only in server-side code paths.


### 2.3 Define helper SQL functions

Create immutable or stable helper functions:

- `current_user_id()`.
- `current_tenant_id()`.
- `has_tenant_role(role_name)`.
- `has_permission(permission_name)`.
- `is_service_request()`.

These functions should be used in policies so policy text stays readable.

### 2.4 Lock down secrets

Sensitive marketplace credentials must not be readable by client-side code. Store them encrypted at rest in a dedicated table or vault-backed mechanism and expose only decrypted values to server-only Edge Functions. Never send secret fields to the browser.

### 2.5 Create access review tests

Write SQL tests for:

- Cross-tenant read denial.
- Cross-tenant write denial.
- Service role access on backend paths.
- Membership revocation invalidating access.
- Soft-deleted tenants being inaccessible.


## Milestone 3: auth and session architecture

### 3.1 Configure Supabase SSR in Next.js

Set up cookie-based auth for the merchant dashboard using Supabase SSR, following the pattern recommended for Next.js App Router.[^2]

### 3.2 Create server and client helpers

Build:

- `createSupabaseServerClient()`.
- `createSupabaseBrowserClient()`.
- `requireAuthenticatedUser()`.
- `requireTenantContext()`.
- `requireRole()`.

These helpers must be the only entry points for auth-aware Supabase access in the dashboard.

### 3.3 Implement auth routes

Create routes for:

- Sign in.
- Sign up.
- Email verification.
- Password reset.
- Session refresh.
- Sign out.
- Tenant switch.


### 3.4 Implement middleware

Create middleware that:

- Refreshes expired sessions.
- Blocks unauthenticated access to protected routes.
- Redirects users without tenant membership.
- Preserves `returnTo` paths safely.


### 3.5 Implement server actions

Create server actions for:

- Inviting users.
- Accepting invites.
- Switching active tenant.
- Updating profile.
- Managing access roles.


### 3.6 Add session safety checks

Implement:

- CSRF-safe state transitions.
- Session expiration handling.
- Logout on revoked membership.
- “Active tenant” verification on every server mutation.


## Milestone 4: marketplace provider contract

### 4.1 Define the provider interface

Create a typed interface in `packages/integrations` with methods like:

- `authorize()`.
- `refreshCredentials()`.
- `validateProduct()`.
- `upsertProduct()`.
- `deleteProduct()`.
- `pullOrders()`.
- `acknowledgeOrder()`.
- `updateInventory()`.
- `updateShipment()`.
- `parseWebhook()`.
- `verifyWebhookSignature()`.
- `listConnectionHealth()`.
- `listDiagnostics()`.


### 4.2 Define normalized DTOs

Create canonical DTOs for:

- `NormalizedProduct`.
- `NormalizedVariant`.
- `NormalizedOrder`.
- `NormalizedOrderItem`.
- `NormalizedShipment`.
- `NormalizedInventoryLevel`.
- `NormalizedWebhookEvent`.
- `NormalizedError`.

Each DTO must be provider-agnostic and serializable.

### 4.3 Define mapping primitives

Implement mapping helpers for:

- Category mapping.
- Attribute mapping.
- SKU mapping.
- Stock location mapping.
- Currency mapping.
- Tax/shipping normalization.
- Country/site targeting.


### 4.4 Define provider config shape

Each provider config should support:

- Tenant ID.
- Marketplace account ID.
- Region.
- Credential reference.
- Feature flags.
- Rate limit profile.
- Sync preferences.
- Webhook secrets.
- Last cursor/checkpoint.


### 4.5 Implement stub providers

Create empty or partial providers for:

- Shopee.
- TikTok Shop.
- Lazada.
- Google Merchant.

Only one provider needs a minimal working round-trip in Phase 1; the others can return “not implemented” while conforming to the interface.

## Milestone 5: sync job system

### 5.1 Define job types

Create standard job types:

- `connect_account`.
- `refresh_credentials`.
- `validate_catalog`.
- `sync_products`.
- `sync_orders`.
- `sync_inventory`.
- `sync_shipments`.
- `sync_returns`.
- `sync_diagnostics`.
- `reconcile_state`.
- `replay_event`.
- `resync_entity`.


### 5.2 Implement the job table schema

`marketplace_sync_jobs` should contain:

- `id`.
- `tenant_id`.
- `provider`.
- `account_id`.
- `job_type`.
- `payload`.
- `status`.
- `priority`.
- `attempt_count`.
- `max_attempts`.
- `scheduled_at`.
- `started_at`.
- `finished_at`.
- `next_retry_at`.
- `lock_token`.
- `locked_at`.
- `last_error_code`.
- `last_error_message`.
- `last_error_payload`.


### 5.3 Implement lock acquisition

Build atomic job pickup logic:

- Select eligible job.
- Acquire row lock.
- Mark as processing.
- Set worker token.
- Record worker identity.
- Release or complete safely.


### 5.4 Implement retry policy

Define retry rules per job type:

- Immediate retry for transient network errors.
- Exponential backoff for rate-limit errors.
- No retry for validation errors until corrected.
- Dead-letter after max attempts.


### 5.5 Implement job runner Edge Function

Create an Edge Function that:

- Picks one or more queued jobs.
- Resolves the provider handler.
- Executes the job.
- Stores raw request/response artifacts.
- Updates status and timing.
- Emits logs and metrics.


### 5.6 Schedule the runner

Use pg_cron to invoke the runner on a schedule. Supabase supports scheduling Edge Functions from the database using pg_cron and pg_net.[^3]

### 5.7 Add manual requeue tools

Create admin actions to:

- Retry failed jobs.
- Cancel queued jobs.
- Clone failed jobs into a new run.
- Replay from a checkpoint.
- Force immediate execution.


## Milestone 6: webhook ingestion

### 6.1 Create webhook endpoint structure

For each provider, expose a dedicated Edge Function route:

- `/webhooks/shopee`
- `/webhooks/tiktok`
- `/webhooks/lazada`
- `/webhooks/google-merchant`


### 6.2 Implement webhook verification

Each endpoint must:

- Validate signature if supported.
- Validate timestamp if supported.
- Reject malformed payloads.
- Capture source IP and headers.
- Store the raw body before processing.


### 6.3 Implement idempotency

Use a dedup table with a unique event key so duplicate deliveries are ignored safely. A standard pattern is to insert the unique event ID first and skip processing on unique violation.[^4]

### 6.4 Implement event storage

Every accepted webhook must persist:

- Provider event ID.
- Provider name.
- Tenant ID.
- Account ID.
- Event type.
- Raw payload.
- Parsed payload.
- Signature metadata.
- Processing status.
- Processing timestamps.
- Correlation ID.


### 6.5 Implement event processing pipeline

Webhook processing steps:

1. Verify request.
2. Insert dedup record.
3. Persist raw payload.
4. Enqueue normalized processing job.
5. Return 200 quickly.
6. Process asynchronously.
7. Update event status when complete.

### 6.6 Implement failure handling

If processing fails:

- Keep raw payload.
- Mark event failed.
- Create linked error log.
- Allow replay from admin UI.
- Do not allow duplicate side effects.


## Milestone 7: canonical product model

### 7.1 Define product source of truth

Decide which system owns product truth. For Phase 1, your internal catalog should be the source of truth, and marketplaces are downstream projections.

### 7.2 Implement product validation

Add validation at the canonical layer:

- Title required.
- SKU required.
- Price required.
- Currency required.
- Variant structure valid.
- Inventory location valid.
- Image set valid.
- Category assignment valid.


### 7.3 Implement publish readiness state

A product should have states such as:

- `draft`.
- `ready`.
- `queued`.
- `published`.
- `failed`.
- `needs_attention`.


### 7.4 Implement provider-specific extension fields

Store marketplace-only attributes separately so the canonical model stays clean. Use JSONB for provider extensions, but validate them with typed schemas before save.

### 7.5 Implement mapping lifecycle

Create mapping flows for:

- First publish.
- Re-link existing listing.
- Replace listing.
- Unpublish.
- Orphan detection.
- Mapping repair.


## Milestone 8: canonical order model

### 8.1 Define order ingestion rules

Orders from all marketplaces must normalize to one internal structure. Fields should map to customer, items, payments, shipping, fulfillment, and status history.

### 8.2 Implement order idempotency

Use provider order ID plus tenant ID as the unique business key. Any repeated fetch or webhook should update the same order record, not create duplicates.

### 8.3 Implement status mapping

Define a shared state machine:

- `pending`.
- `paid`.
- `processing`.
- `ready_to_ship`.
- `shipped`.
- `delivered`.
- `cancelled`.
- `refunded`.
- `returned`.
- `failed`.


### 8.4 Implement fulfillment linkage

Link orders to shipments and tracking numbers. The canonical model should support multiple shipments if the source marketplace allows split fulfillment.

### 8.5 Implement financial snapshots

Store:

- Item subtotal.
- Shipping fees.
- Platform fees.
- Taxes.
- Discounts.
- Net amount.
- Currency.
- FX metadata if needed.


## Milestone 9: dashboard surfaces

### 9.1 Build integration overview page

This page should show:

- Connected marketplaces.
- Health status.
- Last sync time.
- Error count.
- Pending jobs.
- Credential expiration.


### 9.2 Build connection wizard shell

The wizard should:

- Choose provider.
- Choose tenant.
- Explain permissions.
- Redirect to auth.
- Handle callback result.
- Show success or failure.


### 9.3 Build account detail page

This page should show:

- Account metadata.
- Region.
- Sync preferences.
- Feature flags.
- Recent events.
- Recent jobs.
- Raw errors.


### 9.4 Build event and job inspectors

Each inspector should support:

- Search by ID.
- Search by order/product/SKU.
- Filter by date/status/provider.
- Open raw payload.
- Retry or replay.
- Copy correlation IDs.


### 9.5 Build admin actions

Add server actions for:

- Disconnect account.
- Rotate secret.
- Reauthorize account.
- Re-run sync.
- Force full reconciliation.
- Clear failed job after fix.


## Milestone 10: observability

### 10.1 Add structured logging

Log every meaningful backend action with:

- Correlation ID.
- Tenant ID.
- Provider.
- Account ID.
- Job/event ID.
- Action name.
- Result.
- Duration.
- Error code if any.


### 10.2 Add metrics

Track:

- Jobs created.
- Jobs completed.
- Jobs failed.
- Webhooks received.
- Webhooks deduplicated.
- Orders imported.
- Products published.
- Credential refresh failures.
- Average sync duration.


### 10.3 Add tracing

Propagate correlation IDs through:

- Webhook request.
- Job enqueue.
- Worker execution.
- Database writes.
- UI error display.


### 10.4 Add alert thresholds

Alert on:

- Repeated auth failures.
- Webhook signature failures.
- Job backlog growth.
- Dead-letter spikes.
- Sync delay beyond SLA.
- Tenant connection expiry.


### 10.5 Add error taxonomy

Define standard error categories:

- Auth.
- Permission.
- Rate limit.
- Validation.
- Network.
- Provider outage.
- Data mismatch.
- Unknown.


## Milestone 11: testing strategy

### 11.1 Unit tests

Write tests for:

- Tenant policy helpers.
- DTO normalization.
- Provider interface compliance.
- Retry decision logic.
- Dedup key generation.
- Status mapping.
- Validation rules.


### 11.2 Integration tests

Write tests for:

- Auth callback flow.
- RLS policy enforcement.
- Job insertion and execution.
- Webhook duplicate delivery.
- Reprocessing after failure.
- Raw payload persistence.


### 11.3 Contract tests

For each provider stub, verify:

- Input schema validation.
- Output schema shape.
- Error shape consistency.
- Unsupported operation behavior.


### 11.4 End-to-end tests

Create a single Phase 1 e2e scenario:

1. Sign in as merchant admin.
2. Create tenant.
3. Connect one marketplace sandbox.
4. Save credential record.
5. Receive a sample webhook.
6. Enqueue a job.
7. Process the job.
8. View the result in the dashboard.

## Milestone 12: seed and developer experience

### 12.1 Create seed data

Add:

- One demo tenant.
- One demo admin user.
- One merchant account.
- One sample product.
- One sample order.
- One sample marketplace account.
- One failed job.
- One sample webhook event.


### 12.2 Create local dev scripts

Scripts should support:

- Database reset.
- Seed load.
- Function local run.
- Test execution.
- Migration apply.
- Lint and type-check.


### 12.3 Add developer fixtures

Create mocked provider payloads for:

- Product publish success.
- Product publish failure.
- Order created event.
- Order updated event.
- Inventory updated event.
- Webhook duplicate delivery.
- Rate-limit response.


## Milestone 13: minimal provider implementation target

### 13.1 Choose one provider for real wiring

Implement one provider end-to-end as a thin vertical slice. I recommend Shopee first because it exercises the full integration lifecycle and forces you to solve auth, product mapping, order sync, and webhook handling in a realistic way. Shopee’s Open Platform is a good fit for this role because it is a full commerce connector rather than a feed-only surface.[^5][^6]

### 13.2 Implement only the essentials

For the first real provider, implement:

- Connect account.
- Store credentials.
- Validate one product payload.
- Push one product payload.
- Pull one order batch.
- Accept one webhook event.
- Deduplicate one duplicate webhook.
- Queue one reconciliation job.


### 13.3 Keep the others scaffolded

TikTok, Lazada, and Google Merchant should expose the same provider interface, but their operations can be stubbed until Phase 2. Google Merchant should be planned with the current Merchant API direction in mind, because Google is shifting away from the older Content API model.[^7][^8][^9]

## Execution order

Implement Phase 1 in this exact order:

1. Create ADRs and module boundaries.
2. Build database schema and enums.
3. Enable RLS and policies.
4. Configure auth and tenant session handling.
5. Implement secret storage.
6. Implement provider interface and DTOs.
7. Build job system.
8. Build webhook ingestion.
9. Build canonical product and order models.
10. Build dashboard overview and inspectors.
11. Add logs, metrics, and alerts.
12. Add tests and seed data.
13. Wire one real provider end-to-end.
14. Stub the remaining providers.
15. Run full regression and fix all gaps.

## Definition of done

Phase 1 is complete only if all of the following are true:

- Every tenant-scoped table is protected by RLS.[^1]
- Dashboard auth uses cookie-based Supabase SSR sessions.[^2]
- Scheduled job execution runs through Supabase Edge Functions and pg_cron.[^3]
- Duplicate webhook events are safely ignored via idempotency.[^4]
- One provider is fully wired through the new architecture.
- Three providers are scaffolded behind the same interface.
- Raw payloads, retries, and errors are visible in the dashboard.
- Canonical product and order models are in place.
- Manual replay and retry are implemented.
- Local dev, tests, and seed flows work end to end.


## Suggested implementation breakdown for developers

To make execution unambiguous, assign the work in this order:

- Backend engineer 1: database schema, RLS, helper SQL, seed data.
- Backend engineer 2: Edge Functions, job runner, webhook ingestion.
- Frontend engineer 1: auth, dashboard shell, connection wizard, inspectors.
- Full-stack engineer: provider interface, DTOs, first provider wiring.
- QA engineer: RLS tests, webhook idempotency tests, e2e flows.

That is the full Phase 1 plan. The next useful artifact would be a step-by-step database schema and function spec with exact table columns, policies, and Edge Function endpoints.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20]</span>

<div align="center">⁂</div>

[^1]: https://supabase.com/docs/guides/database/postgres/row-level-security

[^2]: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs

[^3]: https://supabase.com/docs/guides/functions/schedule-functions

[^4]: https://hookdeck.com/webhooks/guides/implement-webhook-idempotency

[^5]: https://api2cart.com/api-technology/shopee-api/

[^6]: https://api2cart.com/news/shopee-api-documentation/

[^7]: https://developers.google.com/shopping-content/guides/quickstart

[^8]: https://support.google.com/merchants/answer/14173602?hl=en

[^9]: https://searchengineland.com/google-content-api-shopping-new-merchant-api-460937

[^10]: https://digitalthriveai.com/en-gb/resources/platform-docs/supabase/supabase-nextjs-integration/

[^11]: https://ws1.greenschoolsalliance.org/blog/ws1.greenschoolsalliance.org/supabase-and-next-js-your-server-client-guide-1764804586

[^12]: https://www.youtube.com/watch?v=v6UvgfSIjQ0

[^13]: https://stackoverflow.com/questions/78442623/nextjs-supabase-ssr-row-level-security

[^14]: https://www.youtube.com/watch?v=-U6DJcjVvGo

[^15]: https://tallyfy.com/products/pro/integrations/handling-idempotency-in-webhooks-and-api/

[^16]: https://www.propelauth.com/post/authentication-with-nextjs-13-and-supabase-app-router

[^17]: https://www.answeroverflow.com/m/1462416112405839873

[^18]: https://docs.asaas.com/docs/how-to-implement-idempotence-in-webhooks

[^19]: https://www.youtube.com/watch?v=jg46fF5Z3lk

[^20]: https://dev.to/hussain101/supabase-edge-functions-4o1

