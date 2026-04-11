import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

async function main() {
  const result = streamText({
    model: google('gemini-3.1-flash-lite-preview'),
    prompt: 'say hello',
  });

  const res = result.toUIMessageStreamResponse();
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  const { value } = await reader.read();
  console.log("CHUNK:", decoder.decode(value));
}
main();
