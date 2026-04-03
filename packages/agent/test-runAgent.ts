import { runAgent } from './src/orchestrator';

async function main() {
  try {
    const res = await runAgent({
      newMessage: 'hello',
      merchantId: 'd28d052d-9486-4e5b-b9f1-ac0995faea7d',
      merchantName: 'Test',
      sessionId: '96f40d5a-bfc3-42af-aa46-98e5a2afb830'
    });
    console.log("Returned from runAgent!");
    console.log("Has toDataStreamResponse:", typeof res.toDataStreamResponse);
    if (res.toDataStreamResponse) {
      const resp = res.toDataStreamResponse();
      console.log("Response status:", resp.status);
    }
  } catch (e) {
    console.error("FATAL ERROR IN RUNAGENT", e);
  }
}
main();
