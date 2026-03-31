const forge = require('node-forge');
const fs    = require('fs');
const { pool } = require('../db/pool');
const merchantService = require('../services/merchant.service');

async function generateTestCert(merchantUid) {
  console.log(`\n🛠️ Generating Self-Signed Test Certificate for ${merchantUid}...\n`);

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [
    { name: 'commonName', value: 'LHDN Test Merchant' || merchantUid },
    { name: 'countryName', value: 'MY' },
    { name: 'organizationName', value: 'Test Org' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const passphrase = 'testpassword123';
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, { generateLocalKeyId: true });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Base64 = Buffer.from(p12Der, 'binary').toString('base64');

  await pool.query(
    `UPDATE merchants 
     SET cert_p12_base64 = $1, cert_passphrase = $2
     WHERE merchant_uid = $3`,
    [p12Base64, passphrase, merchantUid]
  );

  merchantService.invalidateMerchantCache(merchantUid);
  console.log('✅ Test Certificate created and uploaded to DB.');
  console.log(`🔒 Passphrase: ${passphrase}\n`);
}

const uid = process.argv[2];
if (!uid) { console.error('Usage: node scripts/generate-self-signed-cert.js <merchantUid>'); process.exit(1); }
generateTestCert(uid).catch(e => { console.error(e); process.exit(1); });
