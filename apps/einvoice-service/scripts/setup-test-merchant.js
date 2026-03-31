require('dotenv').config();
const { runMigrations } = require('../db/migrate');
const merchantService   = require('../services/merchant.service');

const TEST_MERCHANTS = [
  {
    merchantUid:        'test-merchant-alpha',
    name:               'Alpha Retail Sdn Bhd',
    tin:                process.env.SUPPLIER_TIN    || 'C12345678901',
    brn:                process.env.SUPPLIER_BRN    || '202001000001',
    phone:              process.env.SUPPLIER_PHONE  || '+60312345678',
    email:              process.env.SUPPLIER_EMAIL  || 'alpha@test.com',
    address:            process.env.SUPPLIER_ADDRESS || 'No 1, Jalan Alpha',
    postcode:           process.env.SUPPLIER_POSTCODE || '50000',
    city:               process.env.SUPPLIER_CITY   || 'Kuala Lumpur',
    state:              process.env.SUPPLIER_STATE  || '14',
    msic:               '47910',
    lhdnClientId:       process.env.MYINVOIS_CLIENT_ID,
    lhdnClientSecret:   process.env.MYINVOIS_CLIENT_SECRET,
  },
  {
    merchantUid:        'test-merchant-beta',
    name:               'Beta Commerce Sdn Bhd',
    tin:                process.env.SUPPLIER_TIN    || 'C12345678901',
    brn:                process.env.SUPPLIER_BRN    || '202001000001',
    phone:              '+60387654321',
    email:              'beta@test.com',
    address:            'No 2, Jalan Beta',
    postcode:           '47500',
    city:               'Subang Jaya',
    state:              '10',
    msic:               '47910',
    lhdnClientId:       process.env.MYINVOIS_CLIENT_ID,
    lhdnClientSecret:   process.env.MYINVOIS_CLIENT_SECRET,
  },
];

async function setup() {
  console.log('\n🔧 Setting up test merchants...\n');

  await runMigrations();

  for (const merchant of TEST_MERCHANTS) {
    try {
      await merchantService.createMerchant(merchant);
      console.log(`✅ Created: ${merchant.merchantUid}`);
    } catch (err) {
      if (err.message.includes('unique') || err.message.includes('duplicate')) {
        console.log(`⚠️  Already exists: ${merchant.merchantUid} — skipping`);
      } else {
        throw err;
      }
    }
  }

  console.log('\n✅ Test merchants ready.');
  console.log('   Run: node __tests__/phase2.verify.js\n');
  process.exit(0);
}

setup().catch(err => { console.error(err.message); process.exit(1); });
