<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Got an error 400 when trying to send message

A 400 error means the **request body has something wrong** — most likely the phone number format or a missing field. Can you paste the exact `curl` command you used? In the meantime, here are the most common causes and fixes:[^1]

***

## Most Common Causes

### ❌ Wrong Phone Number Format

This is the \#1 cause. The number **must** include the country code and end with `@s.whatsapp.net`:[^2]

```bash
# ❌ Wrong
"number": "0112345678"
"number": "+60112345678"
"number": "60112345678"

# ✅ Correct (Malaysian number example)
"number": "60112345678@s.whatsapp.net"
```


***

### ❌ Missing `text` Field

Make sure your JSON body has `text`, not `message` or `body`:[^3]

```bash
# ❌ Wrong
-d '{"number": "60112345678@s.whatsapp.net", "message": "Hello"}'

# ✅ Correct
-d '{"number": "60112345678@s.whatsapp.net", "text": "Hello"}'
```


***

### ❌ Missing `Content-Type` Header

```bash
# Must include this header
-H "Content-Type: application/json"
```


***

## Full Correct Command

Copy this exactly (replace your IP, API key, and number):[^3]

```bash
curl -X POST http://YOUR_VPS_IP:8080/message/sendText/my-whatsapp \
  -H "Content-Type: application/json" \
  -H "apikey: your-strong-secret-key" \
  -d '{
    "number": "60112345678@s.whatsapp.net",
    "text": "Hello from Evolution API!"
  }'
```


***

Paste the **full error response** (not just "400") and I can pinpoint the exact issue! 🔍
<span style="display:none">[^10][^11][^12][^13][^14][^15][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.mintlify.com/EvolutionAPI/evolution-api/api/errors

[^2]: https://github.com/EvolutionAPI/evolution-api/issues/2288

[^3]: https://www.mintlify.com/EvolutionAPI/evolution-api/api/messages/send-text

[^4]: https://github.com/EvolutionAPI/evolution-api/issues/1247

[^5]: https://community.n8n.io/t/node-evolution-api-error-buttons-400-status-400-error-bad-request-response-message-buttons-0-requires-property-text/153728

[^6]: https://www.scribd.com/document/820430401/evolutionapi-evolution-api-v2-1-logs-5

[^7]: https://mintlify.com/EvolutionAPI/evolution-api/api/errors

[^8]: https://stackoverflow.com/questions/79663760/evolution-api-v2-why-do-i-get-404-not-found-when-trying-to-send-a-message-with

[^9]: https://github.com/EvolutionAPI/evolution-api/issues/1712

[^10]: https://github.com/EvolutionAPI/evolution-api/issues/1930

[^11]: https://www.scribd.com/document/820430400/evolutionapi-evolution-api-v2-1-logs-4

[^12]: https://github.com/EvolutionAPI/evolution-api/issues/683

[^13]: https://github.com/EvolutionAPI/evolution-api/issues/383

[^14]: https://github.com/EvolutionAPI/evolution-api/issues/1621

[^15]: https://github.com/EvolutionAPI/evolution-api/issues/1279

