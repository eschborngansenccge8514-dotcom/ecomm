require('dotenv').config();
const merchantService = require('../services/merchant.service');
const { pool }        = require('../db/pool');
const { getToken }    = require('../services/auth');
const einvoice        = require('../services/einvoice.service');

const DRY_RUN = !process.argv.includes('--confirm');

async function migrateToProduction(merchantUid) {
  console.log(`\n🚀 Production Migration — ${merchantUid}`);
  console.log(DRY_RUN ? '⚠️  DRY RUN — no changes. Add --confirm to go live.\n' : '🔴 LIVE RUN — migrating to production.\n');

  const merchant = await merchantService.getMerchant(merchantUid);

  try {
    // 1. Check current env
    if (merchant.env === 'production') throw new Error('Already in production');

    // 2. Test production token (temporary override)
    console.log('Testing production credentials...');
    const testMerchant = { ...merchant, env: 'production' };
    await getToken(testMerchant);
    console.log('✅ Production credentials valid.');

    if (DRY_RUN) {
      console.log('\n✅ Dry run passed. Run with --confirm to switch environment.');
      process.exit(0);
    }

    // 3. Switch environment in DB
    console.log('Switching environment to production...');
    await pool.query(`UPDATE merchants SET env = 'production' WHERE id = $1`, [merchant.id]);
    merchantService.invalidateMerchantCache(merchantUid);

    // 4. Issue a tiny production test invoice & cancel it
    console.log('Issuing production test invoice (will be cancelled)...');
    const result = await einvoice.issueInvoice(merchantUid, {
      orderNumber: `PROD-TEST-${Date.now()}`,
      buyer: { tin: 'EI00000000010', name: 'General Public' },
      items: [{ description: 'Production Test', quantity: 1, unitPrice: 1.00 }]
    });

    await einvoice.cancelInvoice(merchantUid, result.uuid, 'Production connectivity test', result.order_number);
    console.log(`✅ Production test successful. UUID: ${result.uuid}`);

    console.log('\n🎉 Merchant is now LIVE on production LHDN.');

  } catch (err) {
    console.error(`\n❌ Migration failed: ${err.message}`);
    process.exit(1);
  }
}

const uid = process.argv[2];
if (!uid) { console.error('Usage: node scripts/migrate-merchant-to-prod.js <merchantUid> [--confirm]'); process.exit(1); }
migrateToProduction(uid).catch(e => { console.error(e); process.exit(1); });
