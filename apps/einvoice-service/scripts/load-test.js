require('dotenv').config();
const einvoice        = require('../services/einvoice.service');
const { pool }        = require('../db/pool');

const CONCURRENT_JOBS = 5;

async function runLoadTest() {
  console.log('\n⚡ e-Invoice Load Test (Multi-Merchant Snapshot)\n' + '─'.repeat(50));

  const { rows: merchants } = await pool.query("SELECT merchant_uid FROM merchants WHERE status = 'active' LIMIT 5");
  if (merchants.length === 0) { console.error('No active merchants.'); process.exit(1); }

  console.log(`Testing ${merchants.length} merchants concurrently...`);

  const startTime = Date.now();
  const results = await Promise.allSettled(merchants.map(async (m) => {
    const merchantUid = m.merchant_uid;
    const batch = Array.from({ length: CONCURRENT_JOBS }, (_, i) => ({
      orderNumber: `LOAD-${merchantUid}-${i}-${Date.now()}`,
      buyer: { tin: 'EI00000000010', name: 'General Public' },
      items: [{ description: 'Load Test', quantity: 1, unitPrice: 10.00 }]
    }));

    return Promise.all(batch.map(job => einvoice.issueInvoice(merchantUid, job)));
  }));

  const duration = (Date.now() - startTime) / 1000;
  const passed = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log('\n📊 Results');
  console.log(`Passed: ${passed} batches (${passed * CONCURRENT_JOBS} invoices)`);
  console.log(`Failed: ${failed} batches`);
  console.log(`Time:   ${duration}s`);
  console.log(`Rate:   ${((passed * CONCURRENT_JOBS) / duration).toFixed(2)} inv/sec`);

  if (failed > 0) process.exit(1);
}

runLoadTest().catch(e => { console.error(e); process.exit(1); });
