const eligibility = require('../services/eligibility');

const mockMerchant = { id: 1, msic: '47910' }; // Retail
const restrictedMerchant = { id: 2, msic: '45101' }; // Motor vehicles

const orders = [
  { id: 1, orderNumber: 'ORD-001', subtotal: 100, tax: 6, buyer: { tin: 'EI00000000010' } }, // Eligible
  { id: 2, orderNumber: 'ORD-002', subtotal: 15000, tax: 900, buyer: { tin: 'EI00000000010' } }, // Threshold
  { id: 3, orderNumber: 'ORD-003', subtotal: 500, tax: 30, buyer: { tin: 'C25812345670' } }, // B2B
  { id: 4, orderNumber: 'ORD-004', subtotal: 200, tax: 12, buyer: { tin: 'EI00000000010' } }, // Restricted (for merchant 2)
];

console.log('--- Testing Eligibility Service ---');

orders.forEach(o => {
  const result = eligibility.checkEligibility(o, mockMerchant);
  console.log(`Order ${o.orderNumber} (Retail): ${result.eligible ? '✅ Eligible' : `❌ ${result.reason}`}`);
});

console.log('\n--- Testing Restricted Merchant ---');
const res4 = eligibility.checkEligibility(orders[3], restrictedMerchant);
console.log(`Order ORD-004 (Motor): ${res4.eligible ? '✅ Eligible' : `❌ ${res4.reason}`}`);

console.log('\n--- Script Verification Complete ---');
