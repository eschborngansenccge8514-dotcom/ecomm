import { streamText, generateText } from "ai";
import { google } from "@ai-sdk/google";
console.log("Types of streamText:", typeof streamText);
async function run() {
  try {
    const res = await generateText({ model: google('gemini-3.1-flash-lite-preview'), prompt: 'hi' });
    console.log("Success:", res.text);
  } catch (e: any) {
    console.error("Caught Error:", e.message);
  }
}
run();
