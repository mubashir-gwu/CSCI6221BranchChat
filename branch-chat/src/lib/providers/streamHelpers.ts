import type { StreamChunk } from './types';

export function encodeSSEEvent(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createSSEStream(
  generator: AsyncGenerator<StreamChunk>,
  options: {
    onDone?: (chunk: Extract<StreamChunk, { type: 'done' }>) => Promise<void> | void;
    onError?: (chunk: Extract<StreamChunk, { type: 'error' }>) => Promise<void> | void;
    signal?: AbortSignal;
  }
): ReadableStream {
  let aborted = false;

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Initial padding comment to flush browser buffers
      controller.enqueue(encoder.encode(':\n\n'));

      try {
        for await (const chunk of generator) {
          if (aborted || options.signal?.aborted) {
            break;
          }

          if (chunk.type === 'token') {
            controller.enqueue(
              encoder.encode(encodeSSEEvent('token', { content: chunk.content }))
            );
          } else if (chunk.type === 'done') {
            if (options.onDone) {
              await options.onDone(chunk);
            }
            // The done event data is written by the caller after onDone completes
            // so it can include DB-saved node data
          } else if (chunk.type === 'error') {
            if (options.onError) {
              await options.onError(chunk);
            }
          }
        }
      } catch (err: any) {
        if (!aborted) {
          const errorMsg = err?.message ?? 'Stream error';
          controller.enqueue(
            encoder.encode(encodeSSEEvent('error', { message: errorMsg, partial: false }))
          );
        }
      } finally {
        if (!aborted) {
          controller.close();
        }
      }
    },
    cancel() {
      aborted = true;
    },
  });
}
