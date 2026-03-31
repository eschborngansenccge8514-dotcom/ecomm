// Usage: node scripts/upload-cert.js <merchantUid> <path/to/cert.p12> [passphrase]
// e.g.:  node scripts/upload-cert.js shop_abc123 ./certs/shop_abc123.p12 myPassphrase

require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const forge   = require('node-forge');
const { pool } = require('../db/pool');
const merchantService = require('../services/merchant.service');
const { invalidateCertCache } = require('../services/signer');

async function uploadCert(merchantUid, certPath, passphrase = '') {
  console.log(`\n📤 Uploading certificate for merchant: ${merchantUid}`);
  console.log(`   File: ${certPath}\n`);

  // ── Validate cert file exists ─────────────────────────────────────────
  const resolvedPath = path.resolve(certPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Certificate file not found: ${resolvedPath}`);
  }

  // ── Parse .p12 to extract metadata ───────────────────────────────────
  const pfxBuffer = fs.readFileSync(resolvedPath);
  const p12Asn1   = forge.asn1.fromDer(pfxBuffer.toString('binary'));

  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);
  } catch {
    throw new Error('Failed to parse .p12 — wrong passphrase or corrupt file.');
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const cert     = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  if (!cert) throw new Error('No certificate found in .p12 file.');

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const hasKey  = !!keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
  if (!hasKey) throw new Error('No private key found in .p12 file.');

  const issuerName   = cert.issuer.attributes.map(a => `${a.shortName}=${a.value}`).join(', ');
  const serialNumber = cert.serialNumber;
  const expiry       = cert.validity.notAfter;
  const certBase64   = pfxBuffer.toString('base64');

  console.log(`   Issuer:  ${issuerName}`);
  console.log(`   Serial:  ${serialNumber}`);
  console.log(`   Expires: ${expiry.toISOString().split('T')[0]}`);
  console.log(`   HasKey:  ${hasKey}`);

  // ── Confirm before writing to DB ──────────────────────────────────────
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => {
    rl.question('\n⚠️  Write this certificate to DB? (yes/no): ', (answer) => {
      rl.close();
      if (answer.toLowerCase() !== 'yes') {
        console.log('Aborted.');
        process.exit(0);
      }
      resolve();
    });
  });

  // ── Write to merchants table ──────────────────────────────────────────
  const merchant = await merchantService.getMerchant(merchantUid);

  await pool.query(`
    UPDATE merchants SET
      cert_p12_base64     = $1,
      cert_passphrase     = $2,
      cert_issuer_name    = $3,
      cert_serial_number  = $4
    WHERE merchant_uid = $5
  `, [certBase64, passphrase, issuerName, serialNumber, merchantUid]);

  // Invalidate cert cache so next request uses the new cert
  invalidateCertCache(merchant.id);
  merchantService.invalidateMerchantCache(merchantUid);

  console.log(`\n✅ Certificate uploaded for merchant "${merchantUid}"`);
  console.log('   Run validate-cert.js to verify before going live.\n');
  process.exit(0);
}

const [,, merchantUid, certPath, passphrase] = process.argv;
if (!merchantUid || !certPath) {
  console.error('Usage: node scripts/upload-cert.js <merchantUid> <cert.p12> [passphrase]');
  process.exit(1);
}

uploadCert(merchantUid, certPath, passphrase || '').catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
