import { browserWorker, createWorkerRuntime, consumeResult, transferBuffers } from '@mapseekai/tasklane';
import type { Tasks } from './tasks.js';

export async function convertCoordinates(): Promise<number[]> {
  const runtime = createWorkerRuntime<Tasks>({
    pools: {
      compute: {
        factory: browserWorker(new URL('./compute.worker.js', import.meta.url)),
        size: 2,
      },
    },
  });
  try {
    return await runtime.withScope('coordinates', async (scope) => {
      const handle = scope.enqueue('convert', {
        pool: 'compute',
        priority: 'interactive',
        budget: { inputBytes: 24, scratchBytes: 0, outputBytes: 12 },
        prepare: () => {
          const input = new Float64Array([1, 2, 3]);
          return { payload: input, transfer: transferBuffers(input) };
        },
      });
      return consumeResult(handle, (result) => Array.from(result));
    });
  } finally {
    await runtime.dispose();
  }
}
