const config = require('../config');
const db     = require('../db/invoice.db');

// Token cache per merchant.id (internal DB ID)
// { [merchantId]: { token, expiry } }
const _tokens = new Map();

function getTokenUrl(merchant) {
  return config.getURLs(merchant).TOKEN;
}

/**
 * Gets a token for a specific merchant.
 * If merchant is null, it falls back to global config (admin/supplier defaults).
 */
async function getToken(merchant = null) {
  let clientId = config.CLIENT_ID;
  let clientSecret = config.CLIENT_SECRET;
  let cacheKey = 'global';

  if (merchant) {
    clientId = merchant.lhdn_client_id;
    clientSecret = merchant.lhdn_client_secret;
    cacheKey = merchant.id;

    const cached = _tokens.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.token;
  } else {
    const cached = _tokens.get('global');
    if (cached && Date.now() < cached.expiry) return cached.token;
  }

  const start = Date.now();
  let responseBody, statusCode;

  try {
    const url = getTokenUrl(merchant);
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     clientId,
        client_secret: clientSecret,
        scope:         'InvoicingAPI',
      }),
    });

    statusCode   = res.status;
    responseBody = await res.json();

    if (!res.ok) {
      throw new Error(`Token request failed [${res.status}]: ${JSON.stringify(responseBody)}`);
    }

    const token = responseBody.access_token;
    const expiry = Date.now() + (responseBody.expires_in - 60) * 1000;

    _tokens.set(cacheKey, { token, expiry });

    console.log(`[Auth] Token refreshed for ${cacheKey}. Expires in ${responseBody.expires_in}s (env: ${merchant?.env || 'global'})`);
    return token;

  } catch (err) {
    // Audit log failed auth
    await db.auditLog({
      orderNumber:  null,
      merchant_id:  merchant?.id || null,
      action:       'auth',
      endpoint:     getTokenUrl(merchant),
      requestBody:  { grant_type: 'client_credentials', client_id: clientId },
      responseBody: responseBody || { error: err.message },
      statusCode:   statusCode || 0,
      durationMs:   Date.now() - start,
    }).catch(() => {});

    throw new Error(`[Auth] ${err.message}`);
  }
}

async function apiHeaders(merchant = null, extra = {}) {
  const token = await getToken(merchant);
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json',
    ...extra,
  };
}

function invalidateToken(merchantId = null) {
  _tokens.delete(merchantId || 'global');
  console.log(`[Auth] Token invalidated for ${merchantId || 'global'}.`);
}

module.exports = { getToken, apiHeaders, invalidateToken };
