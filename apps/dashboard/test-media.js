const apiURL = process.env.EVOLUTION_API_URL || 'https://ws.senang.store';
const apiKey = process.env.EVOLUTION_API_KEY || 'eca4TXEvynXJcmioXEOnTTMCUmOGABFr';
const instance = process.env.WHATSAPP_INSTANCE_NAME || 'Test';

async function run() {
  const dummyBase64 = Buffer.from('Hello world').toString('base64');
  console.log('Sending media...');
  const response = await fetch(`${apiURL}/message/sendMedia/${instance}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'apikey': apiKey 
    },
    body: JSON.stringify({
      number: '60123456789', // Put a test number or a dummy
      mediatype: 'document',
      mimetype: 'application/pdf',
      caption: 'Test document',
      media: dummyBase64,
      fileName: 'test.pdf'
    })
  })
  
  console.log(response.status);
  console.log(await response.text());
}
run();
