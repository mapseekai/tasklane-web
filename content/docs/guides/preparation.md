---
title: "异步输入准备"
linkTitle: "异步输入准备"
description: "当任务输入需要先经过异步 I/O 读取时，使用 enqueuePrepared 与 prepareAsync 避免空占 Worker 线程。"
weight: 10
doc_type: how-to
---

在普通的 `scope.enqueue()` 中，`prepare()` 必须是一个**同步函数**（如果你在里面写了 `async` 或返回了 Promise，会直接报错 `INVALID_ARGUMENT`）。

为什么会有这个限制？因为普通任务在调用 `prepare()` 时，**已经把一个宝贵的物理 Worker 线程锁在手里了**。如果这时你在主线程慢吞吞地等磁盘或网络异步读取，那个被锁住的 Worker 线程就只能干等着空转。

那么，如果你的任务输入确实需要先调用 `await blob.arrayBuffer()`、或者从 IndexedDB 异步读取，该怎么办？答案是使用 **`scope.enqueuePrepared()`**。

## 一眼分清：`enqueue` vs `enqueuePrepared`

| 你用哪个方法 | 准备函数 | 执行时占用了 Worker 吗？ | 适合做什么 |
| --- | --- | --- | --- |
| **`scope.enqueue`** | `prepare({ signal })`（必须同步返回） | **已占用 Worker** | 直接从内存已有数组切片、组装参数对象（几微秒内搞定） |
| **`scope.enqueuePrepared`** | `prepareAsync({ signal })`（支持 `async/await`） | **还没占 Worker！**（等异步读完数据后，再去领空闲 Worker） | 异步读取本地文件切片（`blob.arrayBuffer()`）、读 IndexedDB |

> **切记：别在 `prepareAsync` 里写死循环计算**
> 不管是 `prepare` 还是 `prepareAsync`，它们都运行在**主线程（调用线程）**。`prepareAsync` 是让你用来 `await` 异步 I/O 的，千万不要在里面写耗时的同步解析或解压循环——重计算永远应该放进 Worker 函数里。

## 实战写法：异步读取 `Blob` 并零拷贝发给 Worker

下面的代码展示了如何用 `enqueuePrepared` 异步读取一个最大 `8 MiB` 的 `Blob` 分片，并在读完后零拷贝移交给 Worker：

```ts
const MiB = 1024 ** 2;

const handle = scope.enqueuePrepared('convert', {
  pool: 'compute',
  priority: 'foreground',
  budget: {
    inputBytes: 8 * MiB,
    scratchBytes: 0,
    outputBytes: 4 * MiB,
  },
  preparationScratchBytes: 0, // 准备阶段如果在主线程额外用了临时缓冲，在这里申报大小
  preparationTimeoutMs: 15_000, // 限制异步读取最多允许花 15 秒
  prepareAsync: async ({ signal }) => {
    signal.throwIfAborted();
    // 1. 此时还没有占用任何 Worker 线程！安心等待异步读取完成
    const buffer = await chunkBlob.arrayBuffer();
    // 2. 异步操作返回后，第一时间检查等待期间任务有没有被取消
    signal.throwIfAborted();
    // 3. 返回构造好的数据，接下来 Runtime 会去分配空闲 Worker 并发送
    return {
      payload: new Float64Array(buffer),
      transfer: [buffer],
    };
  },
});

await consumeResult(handle, (result) => {
  handleConvertedChunk(result);
});
```

## 它是怎么防止“异步读取太快把主线程撑爆”的？

你可能会担心：既然 `prepareAsync` 不用等空闲 Worker 就能先跑，那如果我一口气提交 100 个 `enqueuePrepared`，岂不是会有 100 个 `blob.arrayBuffer()` 同时在主线程并发读取，把内存撑爆？

不会。`tasklane` 用两道闸门死死管住了异步准备的并发度：

1. **人数闸门（`maxPreparingTasks`，默认 `2`）**：
   整个 `Runtime` 默认最多只允许 **2 个任务**同时处于“正在异步准备（`preparing`）”或“已经准备好、正在等空闲 Worker（`prepared`）”的状态。如果前 2 个准备好但还没排上 Worker，第 3 个任务就会老老实实留在队列里，绝不会提前开始读文件。
2. **内存闸门（预算提前锁定）**：
   在调用你的 `prepareAsync` 之前，账本就会先把这个任务的 `inputBytes`、`outputBytes` 以及 `max(preparationScratchBytes, budget.scratchBytes)` 全部预留扣下。
   - 如果你在 `prepareAsync` 内部需要先建一块临时拼接缓冲区，并在 `prepareAsync` 返回前释放掉它，就把它的大小填在 `preparationScratchBytes` 里；
   - 最终 `return` 出去交给 Worker 的数据大小则填在 `budget.inputBytes` 里。

## 踩坑提醒：异步准备期间被取消了怎么办？

如果任务正在跑 `prepareAsync`（比如正在等一个慢速读取），这时用户取消了任务：
- 外面的 `handle.result` 会**立刻报错 `ABORTED`**，让你的界面马上恢复响应；
- 但这笔已经扣下的内存额度和那 1 个准备窗口名额，**必须等到你的 `prepareAsync` 函数真正跑完退栈后才会释放**！如果 `prepareAsync` 里的 Promise 永远卡死不退出，那个名额就会一直被占着（此时即使它迟到返回了数据，`Runtime` 也绝不会再发给 Worker）。
- **最佳实践**：一定要把 `prepareAsync({ signal })` 里的 `signal` 传给底层的异步请求（如 `fetch(url, { signal })`），在每个 `await` 后面加上 `signal.throwIfAborted()`，并设置合理的 `preparationTimeoutMs`。

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [docs/resources.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resources.md)
