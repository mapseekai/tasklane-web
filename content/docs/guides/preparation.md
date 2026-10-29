---
title: "异步输入准备"
linkTitle: "异步输入准备"
description: "使用 enqueuePrepared 约束异步生产和待发送输入。"
weight: 10
doc_type: how-to
---

文件读取或其他异步 I/O 使用 `enqueuePrepared`。它在调用 `prepareAsync` 前取得准备窗口名额和任务额度，准备阶段不绑定 Worker。

```ts
const handle = scope.enqueuePrepared('convert', {
  pool: 'compute',
  budget: { inputBytes: 8 * MiB, scratchBytes: 0, outputBytes: 4 * MiB },
  preparationScratchBytes: 0,
  prepareAsync: async ({ signal }) => {
    signal.throwIfAborted();
    const buffer = await blob.arrayBuffer(); // blob 大小由调用方限制为 8 MiB。
    signal.throwIfAborted();
    return { payload: new Float64Array(buffer), transfer: [buffer] };
  },
});
await consumeResult(handle, consume);
```

示例中的 `MiB`、`blob` 和 `consume` 由调用方提供；输入长度必须满足 Float64Array 的对齐要求。

## 设置准备边界

`maxPreparingTasks` 合计限制准备中和已准备、等待 Worker 的任务，默认 2。准备额度包括任务输入、输出及 `max(preparationScratchBytes, budget.scratchBytes)`。临时数据应在准备回调结束前释放。

`prepare` 与 `prepareAsync` 都在调用线程执行。异步函数中的同步解析或计算仍会阻塞该线程，CPU 密集工作应放进 Worker handler。

## 处理中止

准备回调读取 `signal` 并协作退出。取消可以提前拒绝结果，但准备资源会保持到回调物理结束。持续不结束的生产者会继续占用窗口和清理屏障。

`preparationTimeoutMs` 限制生产回调阶段；`executionTimeoutMs` 从准备准入起覆盖生产、等待 Worker、启动和执行。

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [docs/resources.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resources.md)
