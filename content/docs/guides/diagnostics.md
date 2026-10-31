---
title: "指标与故障诊断"
linkTitle: "指标与故障诊断"
description: "遇到任务卡住不走、内存额度不释放或报错时，如何通过 stats、diagnostics() 与错误码快速定位根因。"
weight: 60
doc_type: how-to
---

在开发或线上运行中，如果你发现“提交的任务一直卡在 `queued` 不动”或者“算完之后内存额度没有退回来”，千万不要靠猜去盲目调大配置。

`tasklane` 把内部所有的账本、队列阻塞原因和阶段耗时都暴露在了 `runtime.stats`、`runtime.diagnostics()` 和 `runtime.resourceDiagnostics()` 上。你只需要打开控制台看一眼这几个字段，就能立刻定位问题。

## 1. 常见症状速查表：哪里卡住看哪里

| 你看到的现象 | 去打印哪个字段看？ | 十有八九是什么原因？怎么修？ |
| --- | --- | --- |
| **任务一直在排队（`queued`），完全不往后走** | `runtime.diagnostics().waitingReasons` | 看哪个数字大于 0：<br>• 如果是 **`budget-output`** 或 **`result-leases`**：说明你前面的任务算完后，主线程拿到结果**忘了释放租约**！请检查是不是漏用了 `consumeResult`，或者对不需要返回值的任务忘了加 `discardResult: true`。<br>• 如果是 **`pool-capacity`** 或 **`global-workers`**：看是不是开了太多独占 `Session` 把线程全占光了。 |
| **`enqueuePrepared` 任务卡住不发给 Worker** | `runtime.stats.preparing`、`runtime.resourceDiagnostics().preparing` | 如果 `preparing` 一直停在 `2`（默认上限），说明你写的 `prepareAsync` 异步函数卡死在某个网络/文件请求上没退出，把准备窗口堵死了。加上 `preparationTimeoutMs` 并检查 `signal`。 |
| **调用 `acquireSession` 立即报错失败** | 捕获 `SessionAdmissionError`，看 `error.reasons` 数组 | 数组里写明了缺什么（比如 `'pool-capacity'` 池子满了、`'cache-budget'` 全局缓存额度不够了，或者 `'interactive-reserve'` 撞上了交互预留保护线）。 |
| **第一次发任务报 `STARTUP_TIMEOUT` 或 `PROTOCOL_ERROR`** | 浏览器 Network 面板与 `package.json` | 1. 看 Network 里 Worker 的 `.js` 地址是不是 404（或者被开发服务器当成未知路由返回了 `index.html`）；<br>2. 检查主线程和独立打包的 Worker 是不是用了不同版本的 `@mapseekai/tasklane`。 |
| **调了 `dispose()` 后，`stats.workers` 没归零** | `runtime.stats.quarantinedWorkers` | 底层 `worker.terminate()` 失败导致线程被安全隔离，或者某个 `setResource` 的异步 `disposer` 关闭函数抛错了。排障后调 `await runtime.retryTermination()`。 |

## 2. 怎么在代码里优雅地捕获和处理错误？

`tasklane` 抛出的所有错误都是 `RuntimeError` 的实例。**请永远用 `error.code` 做 `switch / if` 判断**，不要去正则匹配 `error.message` 文字：

```ts
import { RuntimeError, consumeResult } from '@mapseekai/tasklane';

try {
  await consumeResult(handle, (data) => updateLayer(data));
} catch (error) {
  if (error instanceof RuntimeError) {
    switch (error.code) {
      case 'ABORTED':
        // 用户取消或切换了页面，属于正常现象，直接静默返回
        return;

      case 'REMOTE_ERROR':
        // 你在 Worker 里写的业务计算函数自己抛出了异常！
        // 原始错误的名称、消息、调用栈和附加 details 都保存在 error.remoteError 里：
        console.error(
          'Worker 内部算法报错:',
          error.remoteError?.name,
          error.remoteError?.message,
          error.remoteError?.details,
        );
        break;

      case 'BUDGET_EXCEEDED':
        // 输入/输出数据实际大小超过了你填的 budget（或者忘了配 blobLimits）
        console.error('预算申报不足:', error.message);
        break;

      case 'SESSION_LOST':
        // Session 绑定的 Worker 崩溃了，关闭旧会话并重新打开一个
        await recreateMySession();
        break;

      default:
        console.error(`运行时错误 [${error.code}]:`, error.message);
    }
  }
  throw error;
}
```

全部 16 个错误码的含义详见[错误码参考](/docs/reference/errors/)。

## 3. 觉得任务变慢了？用 `handle.timing` 看时间花在哪

当一个任务从提交到拿回结果花了 500 毫秒，到底是排队等了 480 毫秒，还是 Worker 真的算了 480 毫秒？等待 `await handle.settled` 后打印 `handle.timing` 一目了然：

```ts
await handle.settled;
console.table(handle.timing);
// 包含：queueMs, startupMs, prepareMs, roundTripMs, workerMs, totalMs
```

- **`queueMs` 很大**：时间全花在门口排队等线程或等内存额度上了；
- **`startupMs` 很大**：这是池子里第一个任务，时间花在首次拉起 Worker 线程和加载脚本上了；
- **`prepareMs` 很大**：主线程准备输入数据（`prepare` 或 `prepareAsync`）太慢；
- **`roundTripMs` 比 `workerMs` 大很多**：Worker 真正算（`workerMs`）其实很快，但数据在主线程和 Worker 之间搬运（`roundTripMs - workerMs`）花了很长时间——**赶紧检查是不是大 `ArrayBuffer` 忘了传 `transferBuffers()` / `output(res, [res.buffer])`，导致走了全量复制！**

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/errors.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/errors.ts)
- [src/remote-error.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/remote-error.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
