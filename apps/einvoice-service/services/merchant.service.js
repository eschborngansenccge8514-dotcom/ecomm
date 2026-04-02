const { pool } = require('../db/pool');

// In-memory cache: merchantUid → merchant record
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load a merchant by their internal string ID.
 * @param {string} merchantUid 
 */
async function getMerchant(merchantUid) {
  const cached = _cache.get(merchantUid);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.merchant;
  }

  // 1. Fetch base merchant data from einvoicing schema
  const { rows } = await pool.query(
    `SELECT * FROM einvoicing.merchants WHERE merchant_uid = $1 LIMIT 1`,
    [merchantUid]
  );

  if (rows.length === 0) {
    throw new Error(`[Merchant] Merchant not found in einvoicing: ${merchantUid}`);
  }

  const merchant = rows[0];

  // 2. Fetch LHDN config from public schema (used by working Edge Functions)
  const { rows: configRows } = await pool.query(
    `SELECT * FROM public.merchant_einvoice_config WHERE merchant_id = $1 LIMIT 1`,
    [merchantUid]
  );

  if (configRows.length > 0) {
    const c = configRows[0];
    // Override with verified config
    merchant.lhdn_client_id     = c.client_id;
    merchant.lhdn_client_secret = c.client_secret;
    merchant.tin                = c.tin;
    merchant.brn                = c.brn;
    merchant.msic               = c.msic_code;
    merchant.env                = c.env || 'sandbox';
  }

  _cache.set(merchantUid, {
    merchant,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return merchant;
}

/**
 * Create a new merchant
 */
async function createMerchant(data) {
  const {
    merchantUid, name, tin, brn, phone, email, address, postcode, city, state, msic, lhdnClientId, lhdnClientSecret
  } = data;

  const { rows } = await pool.query(`
    INSERT INTO einvoicing.merchants (
      merchant_uid, name, tin, brn, phone, email, address, postcode, city, state, msic, lhdn_client_id, lhdn_client_secret
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id
  `, [
    merchantUid, name, tin, brn, phone, email, address, postcode, city, state, msic || '47910', lhdnClientId, lhdnClientSecret
  ]);

  return rows[0].id;
}

/**
 * Update merchant details
 */
async function updateMerchant(merchantUid, updates) {
  const columns = Object.keys(updates);
  const values  = Object.values(updates);

  if (columns.length === 0) return;

  const setClause = columns
    .map((col, i) => `${col} = $${i + 2}`)
    .join(', ');

  await pool.query(
    `UPDATE einvoicing.merchants SET ${setClause} WHERE merchant_uid = $1`,
    [merchantUid, ...values]
  );

  invalidateMerchantCache(merchantUid);
}

/**
 * Invalidate cache for a merchant
 */
function invalidateMerchantCache(merchantUid) {
  _cache.delete(merchantUid);
  console.log(`[Merchant] Cache invalidated for: ${merchantUid}`);
}

module.exports = {
  getMerchant,
  createMerchant,
  updateMerchant,
  invalidateMerchantCache,
};
