require('dotenv').config();
const forge           = require('node-forge');
const crypto          = require('crypto');
const merchantService = require('../services/merchant.service');
const { getToken }    = require('../services/auth');

async function validateMerchantCert(merchantUid) {
  console.log(`\n🔐 Certificate Validation — ${merchantUid}\n` + '─'.repeat(50));

  const merchant = await merchantService.getMerchant(merchantUid);
  const results  = [];

  function check(name, fn) {
    try {
      const detail = fn();
      results.push({ name, status: '✅ PASS', detail });
    } catch (err) {
      results.push({ name, status: '❌ FAIL', detail: err.message });
    }
  }

  // 1. Database check
  check('LHDN credentials are configured', () => {
    if (!merchant.lhdn_client_id) throw new Error('lhdn_client_id is empty');
    if (!merchant.lhdn_client_secret) throw new Error('lhdn_client_secret is empty');
    return `client_id: ${merchant.lhdn_client_id.slice(0, 8)}...`;
  });

  // 2. Base64 check
  check('cert_p12_base64 is set in DB', () => {
    if (!merchant.cert_p12_base64) throw new Error('No cert_p12_base64 in DB');
    return `${merchant.cert_p12_base64.length} chars`;
  });

  let pfxBuffer;
  check('cert_p12_base64 is valid Base64', () => {
    pfxBuffer = Buffer.from(merchant.cert_p12_base64, 'base64');
    if (pfxBuffer.length < 100) throw new Error('Decoded cert too small');
    return `${pfxBuffer.length} bytes`;
  });

  // 3. P12 parsing
  let cert;
  check('.p12 parses with stored passphrase', () => {
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12     = forge.pkcs12.pkcs12FromAsn1(p12Asn1, merchant.cert_passphrase || '');
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
    if (!cert) throw new Error('No certificate found in .p12');
    return 'Parsed successfully';
  });

  // 4. Expiry
  check('Certificate is not expired', () => {
    if (!cert) throw new Error('No cert to check');
    const now = new Date();
    const expiry = cert.validity.notAfter;
    if (now > expiry) throw new Error(`Expired on ${expiry.toISOString()}`);
    const daysLeft = Math.floor((expiry - now) / 86400000);
    return `Valid until ${expiry.toISOString().split('T')[0]} (${daysLeft} days)`;
  });

  // 5. Private Key check
  check('Private key is present and usable', () => {
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12     = forge.pkcs12.pkcs12FromAsn1(p12Asn1, merchant.cert_passphrase || '');
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    if (!keyBag?.key) throw new Error('No private key found in .p12');
    return 'Private key present';
  });

  // 6. Token connection test
  try {
    const token = await getToken(merchant);
    results.push({ name: `Token fetch (env: ${merchant.env})`, status: '✅ PASS', detail: `${token.slice(0, 10)}...` });
  } catch (err) {
    results.push({ name: `Token fetch (env: ${merchant.env})`, status: '❌ FAIL', detail: err.message });
  }

  // Final summary
  console.log('\n📋 Results\n' + '─'.repeat(50));
  results.forEach(r => console.log(`${r.status}  ${r.name}\n         └─ ${r.detail}`));
  
  const failed = results.filter(r => r.status.startsWith('❌')).length;
  if (failed === 0) {
    console.log(`\n✅ Merchant "${merchantUid}" is ready for production go-live.\n`);
  } else {
    console.log(`\n❌ Fix issues before switching "${merchantUid}" to production.\n`);
    process.exit(1);
  }
}

const uid = process.argv[2];
if (!uid) { console.error('Usage: node scripts/validate-cert.js <merchantUid>'); process.exit(1); }
validateMerchantCert(uid).catch(e => { console.error(e); process.exit(1); });
