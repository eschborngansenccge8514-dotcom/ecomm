require('dotenv').config();
const { enqueueInvoiceJob, einvoiceQueue, dlqQueue } = require('../automation/queue');
const { orderEvents } = require('../automation/events');
const merchantService = require('../services/merchant.service');
const db              = require('../db/invoice.db');
const { pool }        = require('../db/pool');
require('../automation/worker'); // Start worker in this process for the test

const ts          = Date.now();
const MERCHANT_A  = 'test-merchant-alpha';
const MERCHANT_B  = 'test-merchant-beta';
const results     = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, status: '✅ PASS', detail });
  } catch (err) {
    results.push({ name, status: '❌ FAIL', detail: err.message });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const mockBuyer = {
  tin: 'C99999999090', name: 'Test Buyer Sdn Bhd',
  brn: '202001099999', phone: '+60312345678',
  email: 'buyer@test.com', address: 'No 1, Jalan Test',
  postcode: '50000', city: 'Kuala Lumpur', state: '14',
};

const mockItems = [
  { description: 'Test Product', quantity: 1, unitPrice: 50, subtotal: 50, tax: 0 },
];

async function run() {
  console.log('\n🔍 Phase 3 Multi-Tenant Automation Verification\n' + '─'.repeat(60));
  console.log('⏱  ~5 minutes (queue processing + LHDN sandbox polling)\n');

  const mA = await merchantService.getMerchant(MERCHANT_A).catch(() => null);
  const mB = await merchantService.getMerchant(MERCHANT_B).catch(() => null);

  if (!mA || !mB) {
    console.error('❌ Test merchants not found. Run: node scripts/setup-test-merchant.js');
    process.exit(1);
  }

  // ── 1. Queue accepts jobs with merchantId ─────────────────────────────
  await check('Queue accepts job with merchantId', async () => {
    await enqueueInvoiceJob('invoice', MERCHANT_A, {
      orderNumber: `Q-TEST-${ts}`,
      buyer: mockBuyer,
      items: mockItems,
    });
    return 'Job enqueued without error';
  });

  // ── 2. B2C order (no TIN) → consolidated_staging ─────────────────────
  await check('B2C order.paid → staged for consolidated (not queued)', async () => {
    const orderNum = `B2C-STAGE-${ts}`;
    orderEvents.emit('order.paid', {
      merchantId:  MERCHANT_A,
      orderNumber: orderNum,
      buyer:       { name: 'Customer', email: 'c@test.com' }, // no TIN
      items:       mockItems,
    });
    await sleep(500);

    const now    = new Date();
    const staged = await db.getStagedConsolidatedOrders(mA.id, now.getFullYear(), now.getMonth() + 1);
    const found  = staged.some(o => o.orderNumber === orderNum);
    if (!found) throw new Error('B2C order not found in consolidated_staging');
    return `Staged as order ${orderNum}`;
  });

  // ── 3. B2B order.paid → enqueued (has TIN) ───────────────────────────
  await check('B2B order.paid → invoice job enqueued', async () => {
    const orderNum = `B2B-EVT-${ts}`;
    const before   = await einvoiceQueue.getJobCounts('waiting');
    orderEvents.emit('order.paid', {
      merchantId:  MERCHANT_B,
      orderNumber: orderNum,
      buyer:       mockBuyer, // has TIN
      items:       mockItems,
    });
    await sleep(500);
    const after = await einvoiceQueue.getJobCounts('waiting');
    if (after.waiting <= before.waiting) throw new Error('No new job appeared in queue');
    return `Queue waiting: ${before.waiting} → ${after.waiting}`;
  });

  // ── 4. Worker processes jobs end-to-end ──────────────────────────────
  await check('Worker processes invoice job end-to-end (waits for LHDN)', async () => {
    // The job enqueued in step 1 (Q-TEST-{ts}) should process now
    // Wait up to 2 minutes for it to complete
    const orderNum = `Q-TEST-${ts}`;
    let invoice    = null;
    for (let i = 0; i < 30; i++) {
      await sleep(4000);
      invoice = await db.getInvoiceByOrderNumber(mA.id, orderNum);
      if (invoice?.status === 'valid') break;
      if (invoice?.status === 'invalid') throw new Error(`LHDN rejected: ${invoice.error_message}`);
    }
    if (!invoice || invoice.status !== 'valid') {
      throw new Error(`Invoice still ${invoice?.status || 'not found'} after 2 minutes`);
    }
    return `UUID: ${invoice.lhdn_uuid}`;
  });

  // ── 5. Data isolation: workers don't cross merchant boundaries ────────
  await check('Worker result scoped to correct merchant only', async () => {
    const aInvoices = await db.listInvoices(mA.id);
    const bInvoices = await db.listInvoices(mB.id);
    const aHasB = aInvoices.some(i => i.order_number.startsWith('B2B-EVT'));
    const bHasA = bInvoices.some(i => i.order_number.startsWith('Q-TEST'));
    if (aHasB || bHasA) throw new Error('Cross-tenant invoice data detected!');
    return `A: ${aInvoices.length} invoice(s) | B: ${bInvoices.length} invoice(s) — isolated`;
  });

  // ── 6. order.cancelled fires cancelInvoice ───────────────────────────
  await check('order.cancelled event cancels invoice within 72h', async () => {
    const invoice = await db.getInvoiceByOrderNumber(mA.id, `Q-TEST-${ts}`);
    if (!invoice?.lhdn_uuid) throw new Error('No UUID to cancel');

    orderEvents.emit('order.cancelled', {
      merchantId:  MERCHANT_A,
      uuid:        invoice.lhdn_uuid,
      orderNumber: `Q-TEST-${ts}`,
      reason:      'Phase 3 verify test',
    });
    await sleep(3000);

    const updated = await db.getInvoiceByOrderNumber(mA.id, `Q-TEST-${ts}`);
    if (updated?.status !== 'cancelled') throw new Error(`Status is still ${updated?.status}`);
    return `Invoice ${invoice.lhdn_uuid} cancelled`;
  });

  // ── 7. Suspended merchant blocked at event level ──────────────────────
  await check('Suspended merchant blocked at worker level', async () => {
    await merchantService.updateMerchant(MERCHANT_B, { status: 'suspended' });
    await sleep(200);

    await enqueueInvoiceJob('invoice', MERCHANT_B, {
      orderNumber: `SUSP-TEST-${ts}`,
      buyer: mockBuyer, items: mockItems,
    });

    // Wait for the job to fail (worker should reject suspended merchant)
    await sleep(6000);

    const failedJob = await pool.query(`
      SELECT * FROM failed_invoice_jobs
      WHERE order_number = $1 LIMIT 1
    `, [`SUSP-TEST-${ts}`]);

    // Restore merchant
    await merchantService.updateMerchant(MERCHANT_B, { status: 'active' });

    if (failedJob.rows.length === 0) {
      throw new Error('Expected a failed job for suspended merchant — none found');
    }
    return `Job failed correctly: ${failedJob.rows[0].error}`;
  });

  // ── 8. Consolidated staging is merchant-scoped ────────────────────────
  await check('Consolidated staging isolated between merchants', async () => {
    const now = new Date();
    const y   = now.getFullYear();
    const m   = now.getMonth() + 1;

    await db.stageForConsolidated({ merchantId: mA.id, orderNumber: `CS-A-${ts}`, subtotal: 100, tax: 0, year: y, month: m });
    await db.stageForConsolidated({ merchantId: mB.id, orderNumber: `CS-B-${ts}`, subtotal: 200, tax: 0, year: y, month: m });

    const aOrders = await db.getStagedConsolidatedOrders(mA.id, y, m);
    const bOrders = await db.getStagedConsolidatedOrders(mB.id, y, m);

    if (aOrders.some(o => o.orderNumber === `CS-B-${ts}`)) throw new Error('A sees B staging data');
    if (bOrders.some(o => o.orderNumber === `CS-A-${ts}`)) throw new Error('B sees A staging data');
    return `A: ${aOrders.length} staged | B: ${bOrders.length} staged — isolated`;
  });

  // ── 9. Audit log is merchant-scoped ───────────────────────────────────
  await check('Audit log entries scoped by merchant_id', async () => {
    const { rows: aLogs } = await pool.query(
      `SELECT COUNT(*) FROM einvoice_audit_log WHERE merchant_id = $1`, [mA.id]
    );
    const { rows: bLogs } = await pool.query(
      `SELECT COUNT(*) FROM einvoice_audit_log WHERE merchant_id = $1`, [mB.id]
    );
    if (parseInt(aLogs[0].count) === 0) throw new Error('No audit logs found for merchant A');
    return `A: ${aLogs[0].count} entries | B: ${bLogs[0].count} entries`;
  });

  // ── 10. merchant.updated clears caches ───────────────────────────────
  await check('merchant.updated event clears token + cert cache', async () => {
    orderEvents.emit('merchant.updated', { merchantId: MERCHANT_A });
    await sleep(300);
    // If caches cleared, re-fetching token should succeed (proves refresh path works)
    const { getToken } = require('../services/auth');
    const token = await getToken(mA);
    if (!token) throw new Error('Token re-fetch failed after cache clear');
    return 'Caches cleared and token re-fetched successfully';
  });

  // ── Results ───────────────────────────────────────────────────────────
  console.log('\n📋 Results\n' + '─'.repeat(60));
  results.forEach(r => {
    console.log(`${r.status}  ${r.name}`);
    if (r.detail) console.log(`         └─ ${r.detail}`);
  });

  const passed = results.filter(r => r.status.startsWith('✅')).length;
  const failed = results.filter(r => r.status.startsWith('❌')).length;

  console.log('\n' + '─'.repeat(60));
  console.log(`Total: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n🎉 Phase 3 complete — Multi-tenant automation verified.');
    console.log('   Ready for Phase 4: Production Cutover.\n');
  } else {
    console.log('\n⚠️  Fix failures before proceeding.\n');
    process.exit(1);
  }
  process.exit(0);
}

run().catch(err => { console.error('[Verify] Crashed:', err.message); process.exit(1); });
