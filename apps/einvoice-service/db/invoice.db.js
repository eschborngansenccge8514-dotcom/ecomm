const { pool } = require('./pool');

/**
 * Create a new e-invoice record
 */
async function createInvoice({
  merchantId, orderNumber, submissionUid, status, 
  lhdnUuid, lhdnLongId, qrCodeUrl, errorMessage
}) {
  const { rows } = await pool.query(`
    INSERT INTO einvoicing.einvoices (
      merchant_id, order_number, submission_uid, status, 
      lhdn_uuid, lhdn_long_id, qr_code_url, error_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (order_number) DO UPDATE SET
      status         = EXCLUDED.status,
      submission_uid = COALESCE(EXCLUDED.submission_uid, einvoicing.einvoices.submission_uid),
      lhdn_uuid      = COALESCE(EXCLUDED.lhdn_uuid, einvoicing.einvoices.lhdn_uuid),
      lhdn_long_id   = COALESCE(EXCLUDED.lhdn_long_id, einvoicing.einvoices.lhdn_long_id),
      qr_code_url    = COALESCE(EXCLUDED.qr_code_url, einvoicing.einvoices.qr_code_url),
      error_message  = EXCLUDED.error_message,
      updated_at     = NOW()
    RETURNING *
  `, [
    merchantId, orderNumber, submissionUid, status || 'pending',
    lhdnUuid, lhdnLongId, qrCodeUrl, errorMessage
  ]);
  return rows[0];
}

/**
 * Update an existing invoice
 */
async function updateInvoice(merchantId, orderNumber, updates) {
  const columns = Object.keys(updates);
  const values  = Object.values(updates);
  
  if (columns.length === 0) return;

  const setClause = columns
    .map((col, i) => `${col} = $${i + 3}`)
    .join(', ');

  const { rows } = await pool.query(`
    UPDATE einvoicing.einvoices SET ${setClause}
    WHERE merchant_id = $1 AND order_number = $2
    RETURNING *
  `, [merchantId, orderNumber, ...values]);

  return rows[0];
}

/**
 * Get an invoice by its order number
 */
async function getInvoiceByOrderNumber(merchantId, orderNumber) {
  const { rows } = await pool.query(
    `SELECT * FROM einvoicing.einvoices WHERE merchant_id = $1 AND order_number = $2 LIMIT 1`,
    [merchantId, orderNumber]
  );
  return rows[0];
}

/**
 * List invoices for a merchant
 */
async function listInvoices(merchantId, { status, limit, offset } = {}) {
  let query = `SELECT * FROM einvoicing.einvoices WHERE merchant_id = $1`;
  const params = [merchantId];

  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit || 50, offset || 0);

  const { rows } = await pool.query(query, params);
  return rows;
}

/**
 * Stage an order for consolidated submission
 */
async function stageForConsolidated({ 
  merchantId, orderNumber, subtotal, tax, year, month, 
  isRestricted = false, exclusionReason = null 
}) {
  await pool.query(`
    INSERT INTO einvoicing.consolidated_staging (
      merchant_id, order_number, subtotal, tax, year, month, 
      is_restricted, exclusion_reason
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (order_number) DO UPDATE SET
      subtotal         = EXCLUDED.subtotal,
      tax              = EXCLUDED.tax,
      is_restricted    = EXCLUDED.is_restricted,
      exclusion_reason = EXCLUDED.exclusion_reason,
      staged_at        = NOW()
  `, [
    merchantId, orderNumber, subtotal, tax, year, month, 
    isRestricted, exclusionReason
  ]);
}

/**
 * Get staged orders for consolidation (eligible only)
 */
async function getStagedConsolidatedOrders(merchantId, year, month) {
  const { rows } = await pool.query(`
    SELECT id, order_number AS "orderNumber", subtotal, tax
    FROM einvoicing.consolidated_staging
    WHERE merchant_id = $1 AND year = $2 AND month = $3
      AND consolidated_einvoice_id IS NULL
      AND requested_individual = FALSE
      AND is_restricted = FALSE
    ORDER BY staged_at ASC
  `, [merchantId, year, month]);
  return rows;
}

/**
 * Mark a staged order as requested for individual e-invoice
 */
async function markAsIndividualRequested(merchantId, orderNumber) {
  await pool.query(`
    UPDATE einvoicing.consolidated_staging
    SET requested_individual = TRUE, exclusion_reason = 'Buyer requested individual e-Invoice'
    WHERE merchant_id = $1 AND order_number = $2
  `, [merchantId, orderNumber]);
}

/**
 * Mark orders as consolidated
 */
async function markOrdersConsolidated(merchantId, orderNumbers, einvoiceId) {
  await pool.query(`
    UPDATE einvoicing.consolidated_staging
    SET consolidated_einvoice_id = $1, consolidated_at = NOW()
    WHERE merchant_id = $2 AND order_number = ANY($3)
  `, [einvoiceId, merchantId, orderNumbers]);
}

/**
 * Log a failed job
 */
async function saveFailedJob({ merchantId, jobId, jobType, orderNumber, error, attempts, payload }) {
  await pool.query(`
    INSERT INTO einvoicing.failed_invoice_jobs (
      merchant_id, job_id, job_type, order_number, error, attempts, payload
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [merchantId, jobId, jobType, orderNumber, error, attempts, JSON.stringify(payload)]);
}

/**
 * List failed jobs for a merchant
 */
async function listFailedJobs(merchantId, includeResolved = false) {
  const query = includeResolved
    ? `SELECT * FROM einvoicing.failed_invoice_jobs WHERE merchant_id = $1 ORDER BY failed_at DESC`
    : `SELECT * FROM einvoicing.failed_invoice_jobs WHERE merchant_id = $1 AND resolved = FALSE ORDER BY failed_at DESC`;
  
  const { rows } = await pool.query(query, [merchantId]);
  return rows;
}

/**
 * Resolve a failed job
 */
async function resolveFailedJob(merchantId, jobId, resolvedBy) {
  await pool.query(`
    UPDATE einvoicing.failed_invoice_jobs
    SET resolved = TRUE, resolved_at = NOW(), resolved_by = $3
    WHERE merchant_id = $1 AND id = $2
  `, [merchantId, jobId, resolvedBy]);
}

/**
 * Audit log entry
 */
async function auditLog({ 
  merchantId, orderNumber, action, endpoint, 
  requestBody, responseBody, statusCode, durationMs 
}) {
  const { rows } = await pool.query(`
    INSERT INTO einvoicing.einvoice_audit_log (
      merchant_id, order_number, action, endpoint, 
      request_body, response_body, status_code, duration_ms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [
    merchantId, orderNumber, action, endpoint,
    JSON.stringify(requestBody || {}),
    JSON.stringify(responseBody || {}),
    statusCode, durationMs
  ]);
  return rows[0]?.id;
}

module.exports = {
  createInvoice,
  updateInvoice,
  getInvoiceByOrderNumber,
  listInvoices,
  stageForConsolidated,
  getStagedConsolidatedOrders,
  markAsIndividualRequested,
  markOrdersConsolidated,
  saveFailedJob,
  listFailedJobs,
  resolveFailedJob,
  auditLog
};
