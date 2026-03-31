const crypto = require('crypto');
const forge  = require('node-forge');

const _certCache = new Map();

function loadCertMeta(merchant) {
  const cached = _certCache.get(merchant.id);
  if (cached) return cached;

  if (!merchant.cert_p12_base64) {
    console.warn(`[Signer] Merchant "${merchant.merchant_uid}" has no certificate. Using sandbox placeholder.`);
    const meta = {
      privateKey:   null,
      certificate:  '',
      issuerName:   merchant.cert_issuer_name   || 'CN=LHDN Test Merchant, C=MY, O=Test Org',
      serialNumber: merchant.cert_serial_number || '01',
      certDigest:   Buffer.alloc(32).toString('base64'),
    };
    _certCache.set(merchant.id, meta);
    return meta;
  }

  const pfxBuffer = Buffer.from(merchant.cert_p12_base64, 'base64');
  const p12Asn1   = forge.asn1.fromDer(pfxBuffer.toString('binary'));
  const p12       = forge.pkcs12.pkcs12FromAsn1(p12Asn1, merchant.cert_passphrase || '');

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  const privateKeyPem = keyBag ? forge.pki.privateKeyToPem(keyBag.key) : null;

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag  = certBags[forge.pki.oids.certBag]?.[0];
  const cert     = certBag?.cert;
  if (!cert) throw new Error(`[Signer] No certificate in .p12 for merchant "${merchant.merchant_uid}"`);

  const issuerName = cert.issuer.attributes
    .map(a => `${a.shortName}=${a.value}`)
    .join(', ');

  const certDer    = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certBase64 = Buffer.from(certDer, 'binary').toString('base64');
  const certDigest = crypto.createHash('sha256').update(Buffer.from(certDer, 'binary')).digest('base64');

  const meta = {
    privateKey:   privateKeyPem,
    certificate:  certBase64,
    issuerName,
    serialNumber: cert.serialNumber,
    certDigest,
  };

  _certCache.set(merchant.id, meta);
  return meta;
}

function invalidateCertCache(merchantId) { _certCache.delete(merchantId); }

function hashDocument(invoiceObj) {
  // Hash the MINIFIED JSON of the prefix-less document
  const minified  = JSON.stringify(invoiceObj);
  const docDigest = crypto.createHash('sha256').update(minified, 'utf8').digest('base64');
  const hexHash   = crypto.createHash('sha256').update(minified, 'utf8').digest('hex');
  return { minified, hexHash, docDigest };
}

function signHex(hexHash, privateKeyPem, merchantUid) {
  if (!privateKeyPem) return 'SANDBOX_PLACEHOLDER_SIGNATURE';
  return crypto.sign('RSA-SHA256', Buffer.from(hexHash), {
    key:     privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  }).toString('base64');
}

function buildSignedPropsXml(signingTime, certDigest, issuerName, serialNumber) {
  return [
    `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="id-xades-signed-props">`,
    `<xades:SignedSignatureProperties>`,
    `<xades:SigningTime>${signingTime}</xades:SigningTime>`,
    `<xades:SigningCertificate><xades:Cert>`,
    `<xades:CertDigest>`,
    `<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>`,
    `<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDigest}</ds:DigestValue>`,
    `</xades:CertDigest>`,
    `<xades:IssuerSerial>`,
    `<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${issuerName}</ds:X509IssuerName>`,
    `<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${serialNumber}</ds:X509SerialNumber>`,
    `</xades:IssuerSerial></xades:Cert></xades:SigningCertificate>`,
    `</xades:SignedSignatureProperties></xades:SignedProperties>`,
  ].join('');
}

function injectSignatureBlock(invoiceObj, {
  docDigest, propsDigest, signatureValue,
  certDigest, issuerName, serialNumber,
  certificate, signingTime,
}) {
  const block = {
    UBLExtensions: [{
      UBLExtension: [{
        ExtensionURI: [{ _: 'urn:oasis:names:specification:ubl:dsig:enveloped:xades' }],
        ExtensionContent: [{
          UBLDocumentSignatures: [{
            SignatureInformation: [{
              ID: [{ _: 'urn:oasis:names:specification:ubl:signature:1' }],
              ReferencedSignatureID: [{ _: 'urn:oasis:names:specification:ubl:signature:Invoice' }],
              'ds:Signature': [{
                'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
                Id: 'id-doc-signed-data',
                'ds:SignedInfo': [
                  {
                    'ds:CanonicalizationMethod': [{ Algorithm: 'http://www.w3.org/2006/12/xml-c14n11' }],
                    'ds:SignatureMethod': [{ Algorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256' }],
                    'ds:Reference': [
                      {
                        Id: 'id-doc-signed-data', URI: '',
                        'ds:Transforms': [{
                          'ds:Transform': [{ Algorithm: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature' }]
                        }],
                        'ds:DigestMethod': [{ Algorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' }],
                        'ds:DigestValue': [{ _: docDigest }],
                      },
                      {
                        URI: '#id-xades-signed-props',
                        Type: 'http://uri.etsi.org/01903#SignedProperties',
                        'ds:DigestMethod': [{ Algorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' }],
                        'ds:DigestValue': [{ _: propsDigest }],
                      },
                    ],
                  },
                ],
                'ds:SignatureValue': [{ _: signatureValue }],
                'ds:KeyInfo': [{ 'ds:X509Data': [{ 'ds:X509Certificate': [{ _: certificate }] }] }],
                'ds:Object': [{
                  'xades:QualifyingProperties': [{
                    'xmlns:xades': 'http://uri.etsi.org/01903/v1.3.2#',
                    Target: 'id-doc-signed-data',
                    'xades:SignedProperties': [{
                      Id: 'id-xades-signed-props',
                      'xades:SignedSignatureProperties': [{
                        'xades:SigningTime': [{ _: signingTime }],
                        'xades:SigningCertificate': [{
                          'xades:Cert': [{
                            'xades:CertDigest': [{
                              'ds:DigestMethod': [{ Algorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' }],
                              'ds:DigestValue':  [{ _: certDigest }],
                            }],
                            'xades:IssuerSerial': [{
                              'ds:X509IssuerName':   [{ _: issuerName   }],
                              'ds:X509SerialNumber': [{ _: serialNumber }],
                            }],
                          }],
                        }],
                      }],
                    }],
                  }],
                }],
              }],
            }],
          }],
        }],
      }],
    }],
    Signature: [{
      ID:              [{ _: 'urn:oasis:names:specification:ubl:signature:Invoice' }],
      SignatureMethod: [{ _: 'urn:oasis:names:specification:ubl:dsig:enveloped:xades' }],
    }],
  };

  // Get the key (Invoice, CreditNote, etc.)
  const type = Object.keys(invoiceObj)[0];
  return {
    [type]: invoiceObj[type].map(inv => ({ ...block, ...inv })),
  };
}

function signDocument(invoiceObj, merchant) {
  const cert        = loadCertMeta(merchant);
  const signingTime = new Date().toISOString();
  const { hexHash, docDigest } = hashDocument(invoiceObj);
  const signatureValue = signHex(hexHash, cert.privateKey, merchant.merchant_uid);
  const signedPropsXml = buildSignedPropsXml(signingTime, cert.certDigest, cert.issuerName, cert.serialNumber);
  const propsDigest = crypto.createHash('sha256').update(signedPropsXml, 'utf8').digest('base64');

  const signedInvoice = injectSignatureBlock(invoiceObj, {
    docDigest, propsDigest, signatureValue,
    certDigest:   cert.certDigest,
    issuerName:   cert.issuerName,
    serialNumber: cert.serialNumber,
    certificate:  cert.certificate,
    signingTime,
  });

  return { signedInvoice, docDigest };
}

module.exports = { signDocument, hashDocument, loadCertMeta, invalidateCertCache };
