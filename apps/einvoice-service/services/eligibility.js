const config = require('../config');

/**
 * LHDN Consolidation Eligibility Rules
 */

const RESTRICTED_ACTIVITIES = [
  '4510', // Sale of motor vehicles (4-digit prefix)
  '4540', // Sale of motorcycles
  '5110', // Passenger air transport
  '4100', // Construction
  '4200', // Civil engineering
  '4300', // Specialized construction activities
  '4773', // Retail sale of watches and jewelry
  '9200', // Gambling and betting
];

/**
 * Check if an order is eligible for consolidation
 * @returns {Object} { eligible: boolean, reason: string|null }
 */
function checkEligibility(order, merchant) {
  // 1. Threshold Check (RM 10,000)
  const totalAmount = parseFloat(order.subtotal || 0) + parseFloat(order.tax || 0);
  if (totalAmount > 10000) {
    return { eligible: false, reason: 'Amount exceeds RM 10,000 threshold' };
  }

  // 2. Buyer Request / B2B Check
  // If TIN is provided and it's not the "General Public" TIN, it's considered B2B
  if (order.buyer?.tin && order.buyer.tin !== 'EI00000000010') {
    return { eligible: false, reason: 'B2B transaction / Valid TIN provided' };
  }

  // 3. Restricted Activity Check
  const msic = merchant?.msic || '47910';
  const isRestricted = RESTRICTED_ACTIVITIES.some(code => msic.startsWith(code));
  if (isRestricted) {
    return { eligible: false, reason: `Restricted activity (MSIC: ${msic})` };
  }

  // 4. Item-level checks (if any specific items are restricted)
  // For now, we assume the whole merchant activity dictates it, but we can expand here.

  return { eligible: true, reason: null };
}

module.exports = {
  checkEligibility,
  RESTRICTED_ACTIVITIES
};
