# e-Invoice Service — Ops Runbook

**Service:** Multi-tenant LHDN e-Invoice
**Stack:** Node.js · PostgreSQL · Redis · BullMQ
**Admin panel:** GET /admin/*
**Health endpoint:** GET /health

---

## Contacts

| Role | Name | Contact |
|---|---|---|
| On-call engineer | — | ops@yourcompany.com |
| LHDN helpdesk | MyInvois Support | https://myinvois.hasil.gov.my |

---

## 1. Invoice Stuck in `pending` > 15 Minutes

**Symptom:** `/health` returns `stuck_invoices > 0`

**Cause:** Worker submitted to LHDN but polling timed out before status returned.

**Steps:**
1. Find the stuck invoice:
   ```sql
   SELECT order_number, submission_uid, merchant_id, created_at
   FROM einvoices
   WHERE status = 'pending'
     AND created_at < NOW() - INTERVAL '15 minutes';
   ```

2. Look up `submissionUid` in the MyInvois portal manually.
3. If LHDN shows `Valid` — manually update DB:
   ```sql
   UPDATE einvoices
   SET status = 'valid', lhdn_uuid = '<uuid>', lhdn_long_id = '<longId>',
       qr_code_url = 'https://myinvois.hasil.gov.my/<uuid>/share/<longId>',
       validated_at = NOW()
   WHERE order_number = '<orderNumber>';
   ```
4. If LHDN shows `Invalid` — move to DLQ manually or fix and re-queue.
5. If no record in LHDN portal — re-queue the invoice:
   ```bash
   curl -X POST /admin/merchants/<merchantId>/dlq/<jobId>/retry
   ```

---

## 2. LHDN API Is Down

**Symptom:** All submissions failing, `lhdn_auth: false` in `/health`

**Cause:** LHDN preprod or production API outage.

**Steps:**
1. Check LHDN status: https://myinvois.hasil.gov.my
2. Do nothing — BullMQ retries with exponential backoff (3s → 6s → 12s → 24s → 48s).
3. Jobs stay in queue for up to 5 attempts.
4. If outage > 48s (all retries exhausted) → jobs land in DLQ automatically.
5. Once LHDN recovers, bulk-retry from DLQ:
   ```bash
   # Retry all unresolved failed jobs for a merchant
   curl GET /admin/merchants/<merchantId>/dlq | \
     jq '.[].id' | \
     xargs -I {} curl -X POST /admin/merchants/<merchantId>/dlq/{}/retry
   ```
6. If LHDN is down for > 72h and invoices are being cancelled — escalate to LHDN.

---

## 3. Certificate Expired

**Symptom:** All invoices for one merchant failing with signing errors.

**Steps:**
1. Renew certificate from your CA (LHDN-approved CA list).
2. Upload new `.p12` to the merchant:
   ```bash
   node scripts/upload-cert.js <merchantUid> ./certs/new-cert.p12 <passphrase>
   ```
3. Validate the new cert:
   ```bash
   node scripts/validate-cert.js <merchantUid>
   ```
4. No code changes or deployments needed — cert is loaded from DB at runtime.
5. Retry any failed jobs from the expiry window:
   ```bash
   curl -X POST /admin/merchants/<merchantId>/dlq/<jobId>/retry
   ```

**Prevention:** Weekly DLQ report includes cert expiry warnings 30 days out.

---

## 4. Job in DLQ — Manual Review

**Symptom:** Slack alert "e-Invoice Failed", DLQ count > 0 at `/admin/dlq`

**Steps:**
1. View all unresolved failed jobs:
   ```bash
   curl GET /admin/dlq
   ```
2. For each job, check the `error` field for root cause:
    - `Merchant is suspended` → reactivate merchant
    - `LHDN rejected invoice` → fix invoice data, retry
    - `Token failed` → check merchant's LHDN credentials
    - `No certificate` → upload cert with `upload-cert.js`
    - `LHDN API timeout` → safe to retry, API was down
3. Retry the job (re-queues with original payload):
   ```bash
   curl -X POST /admin/merchants/<merchantId>/dlq/<jobId>/retry \
     -H "Content-Type: application/json" \
     -d '{"resolvedBy": "your-name"}'
   ```
4. If data is unfixable (e.g. duplicate order number) — mark as manually resolved:
   ```bash
   curl -X POST /admin/merchants/<merchantId>/dlq/<jobId>/resolve \
     -d '{"resolvedBy": "your-name"}'
   ```
   Then issue the invoice manually via MyInvois portal.

---

## 5. Customer Disputes Invoice

| Scenario | Timing | Action |
| :-- | :-- | :-- |
| Wrong amount, within 72h | ≤ 72h after validation | Cancel → re-issue correct invoice |
| Wrong amount, after 72h | > 72h | Issue Credit Note or Debit Note |
| Full refund, within 72h | ≤ 72h | Cancel invoice, issue refund |
| Full refund, after 72h | > 72h | Issue Refund Note |

**Cancel an invoice (within 72h):**
```bash
curl -X DELETE /api/invoices/<lhdn-uuid> \
  -H "X-Merchant-Id: <merchantId>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Customer dispute — wrong amount", "orderNumber": "ORD-001"}'
```

**Issue credit note (after 72h):**
```bash
curl -X POST /api/invoices/credit-note \
  -H "X-Merchant-Id: <merchantId>" \
  -H "Content-Type: application/json" \
  -d '{
    "refNumber": "CN-001",
    "originalInvoiceId": "ORD-001",
    "buyer": { ... },
    "items": [ ... ]
  }'
```

---

## 6. Missed Monthly Consolidated Invoice

**Symptom:** Daily overdue cron alert fires, or merchant reports missing submission.

**Deadline:** LHDN requires consolidated invoices within 7 days of month end.

**Steps:**
1. Check what's staged for the overdue period:
   ```sql
   SELECT order_number, subtotal, tax, year, month
   FROM consolidated_staging
   WHERE merchant_id = <id>
     AND year = <year> AND month = <month>
     AND consolidated_einvoice_id IS NULL;
   ```
2. Trigger consolidated invoice manually:
   ```bash
   curl -X POST /api/invoices/enqueue \
     -H "X-Merchant-Id: <merchantId>" \
     -d '{"type": "consolidated", "year": 2026, "month": 2}'
   ```
3. If the 7-day window has passed — submit via MyInvois portal directly and mark staged orders as resolved manually.

---

## 7. New Merchant Onboarding

```bash
# 1. Create merchant record
curl -X POST /api/merchants \
  -d '{"merchantUid":"shop_new","name":"New Shop Sdn Bhd","tin":"...","brn":"...", ...}'

# 2. Upload sandbox cert
node scripts/upload-cert.js shop_new ./certs/shop_new_sandbox.p12 passphrase

# 3. Verify cert
node scripts/validate-cert.js shop_new

# 4. Test in sandbox — place a test order
curl -X POST /api/invoices/order-paid \
  -H "X-Merchant-Id: shop_new" \
  -d '{"orderNumber":"TEST-001","buyer":{...},"items":[...]}'

# 5. When ready for production:
#    a. Upload production cert
node scripts/upload-cert.js shop_new ./certs/shop_new_prod.p12 prodPassphrase
#    b. Update production credentials
curl -X PUT /api/merchants/shop_new \
  -d '{"lhdn_client_id":"prod-id","lhdn_client_secret":"prod-secret"}'
#    c. Dry run
node scripts/migrate-merchant-to-prod.js shop_new
#    d. Go live
node scripts/migrate-merchant-to-prod.js shop_new --confirm
```

---

## 8. Merchant Goes Offline / Needs Suspension

```bash
# Suspend (blocks all new invoice jobs immediately)
curl -X PATCH /admin/merchants/<merchantId>/status \
  -d '{"status": "suspended"}'

# Reactivate
curl -X PATCH /admin/merchants/<merchantId>/status \
  -d '{"status": "active"}'
```

Note: Jobs already in queue will fail and land in DLQ. Re-queue them after reactivation.

---

## 9. Rollback from Production to Sandbox

If a merchant needs to roll back (e.g. cert issue discovered after go-live):
```sql
UPDATE merchants SET env = 'sandbox' WHERE merchant_uid = '<merchantId>';
```
Then invalidate the cache:
```bash
curl -X PUT /api/merchants/<merchantId> -d '{"env": "sandbox"}'
# This triggers merchant.updated → cache cleared automatically
```

---

## 10. Redis Goes Down

**Impact:** Queue stops processing. New jobs cannot be enqueued. Existing jobs are lost if Redis was not persisted.

**Prevention:** `docker-compose.yml` runs Redis with `--appendonly yes` (AOF persistence).

**Recovery:**
1. Restart Redis — jobs in AOF log are replayed automatically.
2. If Redis is completely wiped — identify orders that are still `pending` in DB and re-queue:
   ```sql
   SELECT order_number, merchant_id
   FROM einvoices
   WHERE status = 'pending'
     AND created_at > NOW() - INTERVAL '1 day';
   ```
3. Re-enqueue each via admin API.

---

## Monitoring Endpoints

| Endpoint | Purpose | Expected |
| :-- | :-- | :-- |
| `GET /health` | Full system health check | `{"status":"ok"}` |
| `GET /admin/stats` | Platform-wide invoice counts | HTTP 200 |
| `GET /admin/dlq` | All unresolved failed jobs | Empty array = healthy |
| `GET /admin/queue` | BullMQ queue depths | `waiting` should trend to 0 |
| `GET /admin/merchants/:id/metrics` | Per-merchant stats | `successRate30d: "100.0%"` |

**Set up UptimeRobot (free):** Monitor `GET /health` every 5 minutes. Alert on non-200.
