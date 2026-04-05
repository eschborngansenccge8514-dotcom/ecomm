import { streamText, generateText } from "ai";
import { google } from "@ai-sdk/google";
console.log("Types of streamText:", typeof streamText);
async function run() {
  const res = streamText({ model: google('gemini-3.1-flash-lite-preview'), prompt: 'hi' });
  console.log("Has toTextStreamResponse:", typeof res.toTextStreamResponse);
}
run();
