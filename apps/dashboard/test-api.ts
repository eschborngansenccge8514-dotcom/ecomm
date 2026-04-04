async function test() {
  const payload = {
    sessionId: "test-session",
    merchantId: "test-merchant",
    newMessage: "test message",
    customerEmail: "test@example.com",
    customerName: "Test User"
  };

  try {
    const res = await fetch('http://localhost:3000/api/support/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers));
    
    const reader = res.body?.getReader();
    if (!reader) return;
    
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      console.log("--- CHUNK ---");
      console.log(chunk);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
