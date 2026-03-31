require('dotenv').config();
const einvoice = require('../services/einvoice.service');

async function testSubmission(merchantUid) {
  console.log(`\n🚀 Triggering Sandbox Submission for ${merchantUid}...\n`);

  try {
    const result = await einvoice.issueInvoice(merchantUid, {
      orderNumber: `TEST-SBX-${Date.now()}`,
      buyer: {
        tin:  'EI00000000010', // Sandbox Generic TIN
        name: 'Test Buyer Sdn Bhd',
        brn:  '202401012345',
        email: 'buyer@test.com',
        phone: '60123456789'
      },
      items: [
        { description: 'Testing Service', quantity: 1, unitPrice: 100.00 },
        { description: 'Consultation',    quantity: 2, unitPrice: 50.00 }
      ]
    });

    console.log('\n✅ Submission SUCCESS!');
    console.log(`LHDN UUID:     ${result.uuid}`);
    console.log(`Order Number:  ${result.order_number}`);
    console.log(`Status:        ${result.status}\n`);

  } catch (err) {
    console.error(`\n❌ Submission FAILED: ${err.message}`);
    process.exit(1);
  }
}

const uid = process.argv[2];
if (!uid) { console.error('Usage: node scripts/test-submission.js <merchantUid>'); process.exit(1); }
testSubmission(uid).catch(e => { console.error(e); process.exit(1); });
