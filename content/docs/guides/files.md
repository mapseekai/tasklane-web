---
title: "文件与分块"
linkTitle: "文件与分块"
description: "通过 blobLimits 将大文件句柄传给 Worker，并用 iterateResults 实现“消费完一块、再拉取下一块”的流式读取。"
weight: 30
doc_type: how-to
---

当用户在浏览器里选了一个 `500 MiB` 的本地数据文件（`File` / `Blob`）要解析时，如果主线程直接调 `await file.arrayBuffer()` 把整块文件读进内存再传给 Worker，浏览器标签页往往当场就会因为内存不足而崩溃。

最稳妥的做法是：
1. **只把 `File` 对象本身（它只是一个轻量句柄）传给 Worker**；
2. **让 Worker 用 `file.slice(start, end)` 每次只切一小块（比如 `64 KiB`）读出来返回**；
3. **主线程用 `iterateResults` 像拧水龙头一样，处理完上一块、释放掉内存额度，再去向 Worker 要下一块。**

## 第 1 步：开启 `blobLimits` 允许传递文件附件

为了防止业务代码不小心把几个 G 的文件塞进普通消息里，**`tasklane` 默认禁止传递任何非空的 `File` 或 `Blob`（默认 `blobLimits` 为 `0`）**。

因此，当你要把 `File` 或 `Blob` 放进 `payload` 时，必须在任务选项里显式声明 `blobLimits`：

```ts
await consumeResult(
  session.enqueue('openFile', {
    // 1. budget.inputBytes 只管消息本身的轻量元数据（填 4096 字节绰绰有余）
    budget: { inputBytes: 4096, scratchBytes: 0, outputBytes: 128 },
    // 2. blobLimits.inputBytes 专门管所传 File/Blob 的逻辑文件大小！
    blobLimits: {
      inputBytes: file.size,
      outputBytes: 0,
    },
    prepare: () => ({ payload: { file, chunkSize: 64 * 1024 } }),
  }),
  () => {},
);
```

如果你忘了配 `blobLimits`，入队时会立刻收到一条清晰的 `BUDGET_EXCEEDED` 报错，直接告诉你需要给 `blobLimits.inputBytes` 配多少字节。

## 第 2 步：在 Worker 里保存文件游标并按需切片

因为文件游标（当前读到了第几个字节）需要跨多次请求保持在同一个 Worker 里，我们会在一个独占 `Session` 中操作。Worker 端代码如下：

```ts
import { browserHost, output, serve } from '@mapseekai/tasklane/host';

interface FileCursor {
  file: File;
  chunkSize: number;
  offset: number;
}

serve(browserHost(self), {
  // 1. 打开文件：把 File 句柄和初始偏移量 0 存在当前 Session 的本地缓存里
  openFile({ file, chunkSize }: { file: File; chunkSize: number }, ctx) {
    ctx.cache.setResource('cursor', { file, chunkSize, offset: 0 }, 128, () => {});
    return output({ opened: true });
  },

  // 2. 读取下一块：每次只切出 chunkSize 大小的一块读入内存
  async nextChunk(_input: undefined, ctx) {
    const cursor = ctx.cache.get<FileCursor>('cursor');
    if (!cursor || cursor.offset >= cursor.file.size) {
      return output({ done: true, bytes: new Uint8Array(0) });
    }

    const end = Math.min(cursor.offset + cursor.chunkSize, cursor.file.size);
    const buffer = await cursor.file.slice(cursor.offset, end).arrayBuffer();

    // 异步读取返回后，先检查期间有没有被取消；没取消才推进游标 offset
    ctx.signal.throwIfAborted();
    cursor.offset = end;

    const bytes = new Uint8Array(buffer);
    return output({ done: false, bytes }, [buffer]);
  },
});
```

## 第 3 步：在主线程用 `iterateResults` 逐块拉取消费

在主线程中，使用 `@mapseekai/tasklane` 导出的 `iterateResults({ next, isDone, close })`，就可以直接用标准的 `for await (const chunk of iterator)` 循环来消费数据块：

```ts
import { consumeResult, iterateResults } from '@mapseekai/tasklane';

export async function readFileInChunks(runtime, file: File, signal?: AbortSignal) {
  const scope = runtime.createScope('file-import');
  const session = scope.session('files');
  const chunkSize = 64 * 1024; // 每次最多读 64 KiB

  // 先把 File 句柄发给 Session 保存起来
  await consumeResult(
    session.enqueue('openFile', {
      signal,
      budget: { inputBytes: 4096, scratchBytes: 0, outputBytes: 256 },
      blobLimits: { inputBytes: file.size, outputBytes: 0 },
      prepare: () => ({ payload: { file, chunkSize } }),
    }),
    () => {},
  );

  // 创建拉取式迭代器
  const chunks = iterateResults({
    signal,
    next: (iterSignal) =>
      session.enqueue('nextChunk', {
        signal: iterSignal,
        budget: {
          inputBytes: 64,
          scratchBytes: 0,
          outputBytes: chunkSize + 1024, // 64 KiB 数据 + 1 KiB 协议头余量
        },
        prepare: () => ({ payload: undefined }),
      }),
    isDone: (chunk) => chunk.done, // 看到 done: true 时自动结束循环
    close: () => scope.dispose(),  // 循环结束、break 或报错时自动销毁 Scope
  });

  try {
    for await (const chunk of chunks) {
      // 在这里处理当前这一块 64 KiB 数据。
      // 只有等这轮循环跑完，迭代器才会自动释放上一块租约、再去拉取下一块！
      await saveChunk(chunk.bytes);
    }
  } finally {
    await chunks.dispose();
  }
}
```

### 为什么推荐用 `iterateResults` 而不是自己写 `while` 循环？

因为它自动帮你处理了所有边缘情况：
- **严格单块在途**：上一块的 `ResultLease` 没释放前，绝不会发下一块的请求，不管文件是 100 MiB 还是 10 GiB，内存占用永远只有 1 个块的固定大小；
- **中途退出自动收尾**：如果你在 `for await` 里写了 `break`、抛出了异常，或者外面的 `AbortSignal` 取消了，它都会自动帮你释放当前块的租约并执行 `close()`；
- **注意别存进大数组**：请边读边处理（比如直接写进数据库或更新画布），千万不要在循环里写 `allChunks.push(chunk.bytes)` 把所有块又攒在主线程数组里——那样又会把整个文件的内存全留在主线程了。

## 进阶：如果事先不知道下一块有多大怎么办？（`iterateSizedResults`）

有时候文件里的记录是变长的（这一条记录只有 `2 KiB`，下一条记录可能有 `12 MiB`）。如果每次都按最大可能的 `12 MiB` 去预留 `outputBytes`，会白白浪费预算额度。

这时可以使用**两阶段分块工具**：
1. 在 Worker 里用 `createSizedResultSource({ describe, read })`：先在 `describe` 里看一眼下一条记录的头部，告诉主线程“下一块需要多少字节”；
2. 在主线程用 `iterateSizedResults`：它会先发 `describe` 拿到确切大小，再按这个真实大小去申请 `outputBytes` 并调用 `read` 把数据拉过来。

另外，如果 `close()` 清理函数因为外部临时故障报错了，你还可以在排障后调用 `await chunks.retryCleanup()` 重新执行清理。完整可运行的浏览器文件分块示例见运行时仓库的 [`examples/file-chunks`](https://github.com/mapseekai/tasklane/tree/b40ba606552c4b798ebb803528548151186b364b/examples/file-chunks)。

## 源码与契约

- [src/iterate-results.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/iterate-results.ts)
- [src/sized-results.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/sized-results.ts)
- [src/sized-source.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/sized-source.ts)
- [docs/file-and-session.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/file-and-session.md)
