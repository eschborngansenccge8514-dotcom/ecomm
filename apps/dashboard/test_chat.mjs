import fetch from "node-fetch";
const res = await fetch("http://localhost:3000/api/agent/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Cookie": "sb-dgafjyrittkskxlgswvf-auth-token-code-verifier=test" },
  body: JSON.stringify({ newMessage: "what is your name?" })
});
console.log(res.status);
for await (const chunk of res.body) {
  console.log(Buffer.from(chunk).toString());
}
