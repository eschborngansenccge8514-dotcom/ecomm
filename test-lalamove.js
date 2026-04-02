const crypto = require('crypto');

async function testLalamove() {
  const apiKey = "pk_test_0549396cb9bf5258a5bd3961e05575de";
  const apiSecret = "sk_test_9zmDUg8GK6sKOZkBPLE74HJ7QtOWvqCS7ITIp//nApcWhwew+h5hvJsf3mBqoO0c";
  
  const quoteBody = JSON.stringify({
    data: {
      serviceType: "MOTORCYCLE",
      language: "en_MY",
      stops: [
        {
          coordinates: { lat: "5.4141", lng: "100.3288" },
          address: "Penang Merchant Address"
        },
        {
          coordinates: { lat: "5.4141", lng: "100.3288" },
          address: "Penang Customer Address"
        }
      ]
    }
  });

  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const method = "POST";
  const path = "/v3/quotations";
  const rawSignature = `${timestamp}\r\n${nonce}\r\n${method}\r\n${path}\r\n\r\n${quoteBody}`;

  const signature = crypto.createHmac('sha256', apiSecret).update(rawSignature).digest('hex') + 'INVALID';
  const token = `${apiKey}:${timestamp}:${nonce}:${signature}`;

  console.log("Requesting Quotation...");
  const res = await fetch("https://rest.sandbox.lalamove.com/v3/quotations", {
    method: "POST",
    headers: {
      "Authorization": `hmac ${token}`,
      "Content-Type": "application/json",
      "Market": "MY_KUL",
      "Accept": "application/json"
    },
    body: quoteBody
  });

  console.log(`Status: ${res.status}`);
  console.log(await res.text());
}

testLalamove().catch(console.error);
