import { createUIMessageStreamResponse } from 'ai';

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue({ type: 'text-delta', textDelta: 'Hello ' });
    controller.enqueue({ type: 'text-delta', textDelta: 'World' });
    controller.close();
  }
});

const res = createUIMessageStreamResponse({ stream });
res.text().then(console.log);
