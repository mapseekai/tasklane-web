---
title: "文件与分块"
linkTitle: "文件与分块"
description: "为文件附件和拉取式结果设置可验证的上界。"
weight: 30
doc_type: how-to
---

File/Blob 的逻辑字节数通过任务 `blobLimits` 声明。输入与输出默认都是 0，非空附件必须显式放宽对应上限。

```ts
blobLimits: {
  inputBytes: file.size,
  outputBytes: 0,
},
```

任务的 `budget` 仍需覆盖协议元数据与读取后产生的 ArrayBuffer。`blobLimits` 是每包附件的逻辑大小限制，应用同时持有多少文件由应用控制。

## 拉取式消费

使用 `iterateResults({ next, isDone, close })` 将一次分块读取映射为一次任务。迭代器先释放上一块的结果租约，再请求下一块。

```ts
const chunks = iterateResults({
  next: () => session.enqueue('next', nextOptions),
  isDone: (chunk) => chunk.done,
  close: () => session.dispose(),
});
try {
  for await (const chunk of chunks) {
    await consumeChunk(chunk);
  }
} finally {
  await chunks.dispose();
}
```

此处的 `session`、`nextOptions`、`consumeChunk` 是业务接口。借用长期 Session 时，`close` 应只关闭本次游标；只有拥有 Session 的代码才能关闭它。

## 可变大小块

`iterateSizedResults` 配合 `createSizedResultSource` 分为 describe 与 read：先取得块大小描述，再按实际块上界预留额度，最后生成数据。一次 describe 对应一次读取或明确清理。

`closed` 暴露物理完成与清理结果。清理失败时调用 `retryCleanup()` 重试；首次 `closed` 的失败记录仍然保留。不要把所有已消费块累积到数组中，否则应用持有的数据会超出已归还的额度。

完整文件示例可从[运行时仓库的 examples/file-chunks](https://github.com/mapseekai/tasklane/tree/b40ba606552c4b798ebb803528548151186b364b/examples/file-chunks)运行。

## 源码与契约

- [src/iterate-results.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/iterate-results.ts)
- [src/sized-results.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/sized-results.ts)
- [src/sized-source.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/sized-source.ts)
- [docs/file-and-session.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/file-and-session.md)
