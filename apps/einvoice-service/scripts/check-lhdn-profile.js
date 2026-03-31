const { getToken, apiHeaders } = require('../services/auth');
const merchant = require('../services/merchant.service');

async function checkProfile(merchantUid) {
  try {
    const m = await merchant.getMerchant(merchantUid);
    const headers = await apiHeaders(m);
    const url = 'https://preprod-api.myinvois.hasil.gov.my/api/v1.0/profiles/current';
    
    console.log(`[Auth] Checking profile for client: ${m.lhdn_client_id}...`);
    const res = await fetch(url, { headers });
    const data = await res.json();
    
    if (!res.ok) {
      console.error(`[Error] Failed to fetch profile: ${res.status}`, data);
      return;
    }
    
    console.log('✅ Authenticated Identity Found:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (err) {
    console.error('❌ Error checking profile:', err.message);
  }
}

const uid = process.argv[2] || 'a71e8fdf-a647-439c-b1ad-964dfc7779ba';
checkProfile(uid);
