import { streamText, generateText } from "ai";
import { google } from "@ai-sdk/google";
console.log("Types of streamText:", typeof streamText);
async function run() {
  const res = streamText({ model: google('gemini-2.5-flash'), prompt: 'hi' });
  console.log("Has toDataStreamResponse:", typeof res.toDataStreamResponse);
}
run();
