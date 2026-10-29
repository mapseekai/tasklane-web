import assert from 'node:assert/strict';
import { createWorkerRuntime, consumeResult, transferBuffers } from '@mapseekai/tasklane';
import { nodeWorker } from '@mapseekai/tasklane/node';

const runtime = createWorkerRuntime({
  pools: { compute: { factory: nodeWorker(new URL('./worker.mjs', import.meta.url)), size: 2 } },
  maxWorkers: 2,
});

try {
  await runtime.withScope('example', async (scope) => {
    const task = scope.enqueue('convert', {
      pool: 'compute',
      budget: { inputBytes: 24, scratchBytes: 0, outputBytes: 12 },
      prepare() {
        const input = new Float64Array([1, 2, 3]);
        return { payload: input, transfer: transferBuffers(input) };
      },
    });
    await consumeResult(task, (result) => {
      assert.deepEqual([...result], [1, 2, 3]);
      assert.equal(result.BYTES_PER_ELEMENT, 4);
      console.log('Float32Array:', [...result]);
    });
  });
  assert.equal(runtime.stats.leases, 0);
  assert.equal(runtime.stats.scopes, 0);
} finally {
  await runtime.dispose();
}
assert.equal(runtime.stats.workers, 0);
