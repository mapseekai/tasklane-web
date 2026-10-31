---
title: "测试与验证"
linkTitle: "测试与验证"
description: "使用 createLoopback() 在同一线程内飞快跑完单元测试，并检查内存额度与缓冲区转移是否正确。"
weight: 70
doc_type: how-to
---

给用到了 Worker 的代码写单元测试，平时最头疼的是：为了测一个几行的计算函数，还得先配置打包工具把 Worker 编译成独立文件，测试跑起来又慢又容易受环境影响。

为此，`@mapseekai/tasklane/testing` 专门提供了一个测试神器：**`createLoopback()`**。

## 1. 用 `createLoopback()` 写零线程开销的单元测试

`createLoopback()` 可以在**同一个线程里**直接生成一对相连的 `endpoint`（喂给主线程 `Runtime`）和 `host`（喂给 Worker 端的 `serve`）。

它不需要打包独立 Worker 文件，毫秒级启动，但**底层依然严格执行真实的 `structuredClone`、`Transferable` 内存转移（`detach`）和全部五类预算核查**！你甚至可以调用 `loop.fail(new Error('模拟崩溃'))` 来测试线程崩溃时的恢复逻辑：

```ts
import assert from 'node:assert/strict';
import { createWorkerRuntime, consumeResult, transferBuffers } from '@mapseekai/tasklane';
import { serve, output } from '@mapseekai/tasklane/host';
import { createLoopback } from '@mapseekai/tasklane/testing';

// 1. 直接在同一个测试文件里把 Runtime 和 serve 连起来
const runtime = createWorkerRuntime({
  pools: {
    compute: {
      size: 1,
      factory: () => {
        const loop = createLoopback();
        serve(loop.host, {
          convert(input: Float64Array) {
            const out = Float32Array.from(input);
            return output(out, [out.buffer]);
          },
        });
        return loop.endpoint;
      },
    },
  },
});

// 2. 跑你的业务代码，并同时断言“结果对 + 零拷贝生效 + 额度零残留”
let rawInput: Float64Array | undefined;

await runtime.withScope('test-scope', async (scope) => {
  const handle = scope.enqueue('convert', {
    pool: 'compute',
    budget: { inputBytes: 24, scratchBytes: 0, outputBytes: 12 },
    prepare() {
      rawInput = new Float64Array([10, 20, 30]);
      return {
        payload: rawInput,
        transfer: transferBuffers(rawInput),
      };
    },
  });

  await consumeResult(handle, (result) => {
    assert.deepEqual([...result], [10, 20, 30]);
  });
});

// 断言 1：输入的 ArrayBuffer 确实被零拷贝转走了（原数组长度变成 0）
assert.equal(rawInput?.byteLength, 0);

// 断言 2：没有任何忘记释放的租约、Scope 或内存额度！
assert.equal(runtime.stats.leases, 0);
assert.equal(runtime.stats.scopes, 0);
assert.equal(runtime.stats.reserved.inputBytes, 0);
assert.equal(runtime.stats.reserved.outputBytes, 0);

await runtime.dispose();
```

## 2. 建议在你的项目测试里加上这 4 条检查

很多 Bug（比如内存慢慢漏光）只看“返回值对不对”是测不出来的。建议在你的单元测试末尾固定加上以下检查：

1. **跑完后账本必须归零**：检查 `runtime.stats.leases === 0` 且 `runtime.stats.reserved.outputBytes === 0`，这能立刻抓出业务代码里漏掉 `release()` 的地方；
2. **消费抛错时也不能漏租约**：故意让 `consumeResult` 的回调抛一个异常，确认 `catch` 之后 `runtime.stats.leases` 依然是 `0`；
3. **最大分块不超预算**：拿生产环境最大规格的一块真实数据跑一次，确保你填的 `budget` 留够了元数据余量，不会意外报 `BUDGET_EXCEEDED`；
4. **真机/真浏览器冒烟**：`createLoopback()` 用来测逻辑和账本契约，但在上线前，请至少在目标浏览器或 Node.js 环境里用真实的 `browserWorker` / `nodeWorker` 跑通一次端到端集成测试，确认打包路径和多线程并发一切正常。

## 3. 如果你想运行 `tasklane` 源码仓库自身的测试

在 `tasklane` 运行时源码仓库中，内置了覆盖 Node.js 22/24 以及 Chrome、Firefox、WebKit 三大浏览器的完整测试与大数据压力套件（含 1 GiB 坐标流背压、256 MiB 单包零拷贝与 1000 请求取消风暴）：

```sh
pnpm typecheck
pnpm test
pnpm test:browser
pnpm test:stress
pnpm verify
```

详细测试报告与基准数据见运行时仓库的[测试与验收文档](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/testing.md)与[性能验证文档](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/performance.md)。

## 源码与契约

- [src/testing.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/testing.ts)
- [test/contracts.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/test/contracts.ts)
- [docs/testing.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/testing.md)
- [docs/performance.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/performance.md)
