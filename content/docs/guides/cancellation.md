---
title: "取消与超时"
linkTitle: "取消与超时"
description: "为你的后台算法挑选最合适的取消方式（cooperative / discard / terminate），并在循环中用 ctx.checkpoint() 及时停下任务。"
weight: 20
doc_type: how-to
---

当用户快速拖动地图、切换页面标签，或者点击“取消导入”时，我们已经不需要之前提交的那些后台任务了。

在 `tasklane` 中，你有三种方式触发取消：
1. 取消单个任务：调用 `handle.cancel('原因')`；
2. 用标准信号取消：提交任务时传入 `signal: abortController.signal`，随后调用 `abortController.abort()`；
3. 取消整个模块的所有任务：调用 `await scope.dispose()`。

如果任务**还在队列里排队**，取消会瞬间把它从队列里拿掉并退还额度。但如果任务**已经发进 Worker 正在算了**，怎么停下它？这取决于你在提交任务时选的取消模式（`cancellation`）。

## 1. 三种取消模式怎么选？

请根据你在 Worker 里写的算法特性，从下面三种模式中挑一个（默认是 `'cooperative'`）：

| 取消模式 | Worker 里会发生什么？ | 什么时候选它？ |
| --- | --- | --- |
| **`'cooperative'`（协作取消，默认）** | 主线程发一条取消通知给 Worker；Worker 里的代码在循环检查点（`await ctx.checkpoint()`）看到通知后，自己主动抛错退出，线程保持存活继续接下一个任务 | **首选推荐**。只要你的代码是你自己写的循环或分步逻辑，能在中间插一句 `await ctx.checkpoint()`，就用它 |
| **`'discard'`（算完丢弃结果）** | 不打断正在算的函数，等它顺其自然算完，把算出来的结果直接扔掉 | 适合每次只跑几十毫秒的短任务，或者调了一个没法中途喊停的第三方同步函数，等它算完比杀掉重建线程更划算 |
| **`'terminate'`（强杀重建线程）** | 直接调用底层 `worker.terminate()` 把整个物理线程强行枪毙，需要时再拉起新线程 | 算法彻底卡死在一个耗时几秒的第三方同步调用里没法协作退出。**注意**：必须在 Pool 上显式开启 `allowHardCancel: true` 才能用，且不能用于有状态的 `Session` |

> **为什么 `'terminate'` 需要 Pool 显式开启 `allowHardCancel: true`？**
> 因为直接强杀线程非常暴力，会瞬间丢失该 Worker 本地所有的缓存。如果在没开 `allowHardCancel: true` 的池子上提交 `'terminate'` 任务，会当场报错 `HARD_CANCEL_DENIED`。

## 2. 在长循环里正确响应取消：使用 `await ctx.checkpoint()`

很多刚写 Worker 的开发者会犯一个错误：在一个跑几百万次的纯同步 `for` 循环里写 `if (ctx.signal.aborted) break;`，结果发现怎么取消都停不下来！

**原因很简单**：JavaScript 是单线程事件循环。只要你的同步 `for` 循环没停下来让出主控权，主线程发过来的那条“取消消息”就一直堵在 Worker 的消息队列门外进不来，`ctx.signal.aborted` 永远是 `false`。

正确的做法是：每隔几万次循环，调用一次 **`await ctx.checkpoint()`**。它会**真正让出一次宏观事件循环**（在 Node 中用 `setImmediate`，浏览器中优先用 `scheduler.yield()`，回退用 `MessageChannel`），把门外排队的取消消息放进来；如果发现任务已经被取消了，`checkpoint()` 会直接帮你抛出中止异常跳出函数：

```ts
import { browserHost, output, serve } from '@mapseekai/tasklane/host';

serve(browserHost(self), {
  async convert(input: Float64Array, ctx) {
    const result = new Float32Array(input.length);
    const step = 65_536; // 每处理 64K 个数字作为一小段

    for (let start = 0; start < input.length; start += step) {
      // 关键：真正让出一次事件循环接收取消消息；若已取消则在此处自动抛错退出！
      await ctx.checkpoint();

      const end = Math.min(start + step, input.length);
      for (let i = start; i < end; i++) {
        result[i] = input[i];
      }

      // 可选：顺便向主线程汇报当前进度（最多 4 KiB，底层会自动按 16ms 节流）
      ctx.progress({ done: end, total: input.length });
    }

    return output(result, [result.buffer]);
  },
});
```

> **踩坑提醒**：千万不要用 `await Promise.resolve()` 代替 `await ctx.checkpoint()`！`Promise.resolve()` 是微任务（Microtask），它会在当前这轮循环里插队执行，根本不会给底层的 `MessagePort` 消息回调任何执行机会。

## 3. 配置超时防线：防止任务无限期卡死

除了用户手动取消，你还可以在 `createWorkerRuntime` 全局或单个任务上设置超时时间：

- **`queueTimeoutMs`（排队超时，默认 120 秒）**：如果任务在队列里等了太久还没排上号，自动以 `QUEUE_TIMEOUT` 报错退出。
- **`executionTimeoutMs`（执行超时，默认 120 秒）**：从任务排上号、开始准备或执行的那一刻起开始倒计时。
  - **强力兜底保证**：如果一个任务已经发进了 Worker，但到了 `executionTimeoutMs` 规定时间还没算完返回（哪怕它配的是 `'cooperative'` 或 `'discard'`），为了防止死循环把你的线程池永久废掉，**`Runtime` 会直接强行 `terminate` 杀死那个超时的 Worker 线程**，并向调用方报错 `EXECUTION_TIMEOUT`。
- **`startupTimeoutMs`（启动握手超时，默认 10 秒）**：如果新建 Worker 时因为网络断连或脚本路径 404 迟迟没完成握手，以 `STARTUP_TIMEOUT` 报错。

## 4. 在主线程优雅处理取消

```ts
const controller = new AbortController();
const handle = scope.enqueue('convert', {
  pool: 'compute',
  signal: controller.signal,
  budget: { inputBytes: 8 * 1024 ** 2, scratchBytes: 0, outputBytes: 4 * 1024 ** 2 },
  prepare: () => ({ payload: data }),
});

// 当用户切换视口或点击取消时：
controller.abort('视口已切换');

try {
  await consumeResult(handle, renderToMap);
} catch (error) {
  if (error instanceof RuntimeError && error.code === 'ABORTED') {
    // 1. 这里会立刻捕获到取消，界面可以马上切走，不用等后台线程停下
    return;
  }
  throw error;
}
```

如果你在写测试，或者必须确保后台 Worker 真的已经停下且把内存额度退回来了，只需在后面再加一句 `await handle.settled`。

## 源码与契约

- [src/host.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/host.ts)
- [src/yield.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/yield.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
