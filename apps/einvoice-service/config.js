require('dotenv').config();

const ENV = process.env.NODE_ENV || 'sandbox';

const URLS = {
  sandbox: {
    TOKEN: 'https://preprod-api.myinvois.hasil.gov.my/connect/token',
    API:   'https://preprod-api.myinvois.hasil.gov.my/api/v1.0',
  },
  production: {
    TOKEN: 'https://api.myinvois.hasil.gov.my/connect/token',
    API:   'https://api.myinvois.hasil.gov.my/api/v1.0',
  },
};

/**
 * Resolve correct API URLs for a merchant.
 * Merchants have their own `env` column — allows per-merchant sandbox/production toggle.
 * Falls back to global NODE_ENV if merchant has no override.
 *
 * @param {Object|null} merchant  - merchant DB row (optional)
 */
function getURLs(merchant = null) {
  const env = merchant?.env || ENV;
  return URLS[env === 'production' ? 'production' : 'sandbox'];
}

// Validate required env vars on startup
const REQUIRED = [
  'MYINVOIS_CLIENT_ID',
  'MYINVOIS_CLIENT_SECRET',
  'SUPPLIER_TIN',
  'SUPPLIER_BRN',
  'SUPPLIER_NAME',
  'SUPPLIER_EMAIL',
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
];

function validateConfig() {
  const missing = REQUIRED.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`[Config] Missing required env vars: ${missing.join(', ')}`);
  }
  console.log(`[Config] Environment: ${ENV.toUpperCase()}`);
  console.log(`[Config] API base: ${URLS[ENV === 'production' ? 'production' : 'sandbox'].API}`);
}

module.exports = {
  ENV,
  URLS,
  getURLs,
  validateConfig,

  CLIENT_ID:     process.env.MYINVOIS_CLIENT_ID,
  CLIENT_SECRET: process.env.MYINVOIS_CLIENT_SECRET,

  CERT_PFX_PATH:   process.env.CERT_PFX_PATH,
  CERT_PASSPHRASE: process.env.CERT_PASSPHRASE,
  CERT_ISSUER_NAME:   process.env.CERT_ISSUER_NAME,
  CERT_SERIAL_NUMBER: process.env.CERT_SERIAL_NUMBER,

  SUPPLIER: {
    TIN:      process.env.SUPPLIER_TIN,
    BRN:      process.env.SUPPLIER_BRN,
    NAME:     process.env.SUPPLIER_NAME,
    PHONE:    process.env.SUPPLIER_PHONE,
    EMAIL:    process.env.SUPPLIER_EMAIL,
    ADDRESS:  process.env.SUPPLIER_ADDRESS,
    POSTCODE: process.env.SUPPLIER_POSTCODE,
    CITY:     process.env.SUPPLIER_CITY,
    STATE:    process.env.SUPPLIER_STATE,
    MSIC:     process.env.SUPPLIER_MSIC,
  },

  INVOICE_TYPES: {
    INVOICE:      '01',
    CREDIT_NOTE:  '02',
    DEBIT_NOTE:   '03',
    REFUND_NOTE:  '04',
  },

  CLASS_CODES: {
    ECOMMERCE:    '008',
    CONSOLIDATED: '004',
    OTHERS:       '022',
  },

  // BullMQ retry policy
  QUEUE: {
    ATTEMPTS: 5,
    BACKOFF_DELAY: 3000,
  },
};
