---
title: "数据计费与消费工具"
linkTitle: "数据计费与消费工具"
description: "查询协议计费、transfer 和分块工具的边界。"
weight: 50
doc_type: reference
---

数据工具分别面向协议传输、普通驻留数据和二进制 backing store。选择与资源归属相符的函数。

| 函数 | 返回值 | 用途 |
| --- | --- | --- |
| `packetByteLength(value)` | number | 完整协议计费量；会编码数据 |
| `binaryByteLength(value, limits?)` | number | 唯一二进制 backing store 大小 |
| `dataByteLength(value, limits?)` | number | 普通驻留数据计费，含标量和键名 |
| `transferBuffers(...values)` | ArrayBuffer[] | 校验完整所有权并去重 backing store |
| `transferOwnedBuffers(...values)` | ArrayBuffer[] | transferBuffers 的语义别名 |
| `consumeResult(handle, consume)` | Promise | 消费结束后确定性释放结果 |
| `iterateResults(options)` | ResultIterator | 每次拉取一个租约结果 |
| `iterateSizedResults(options)` | ResultIterator | 先描述、再按实际块上界准入 |
| `createSizedResultSource(options)` | SizedResultSource | Worker 端的两阶段分块数据源 |

## Packet 边界

源码中的默认图限制为：100,000 个对象、1,000,000 条遍历边、4096 个 backing store、256 个不同 File/Blob，以及 64 MiB 元数据与附件引用费用。

Packet 支持标量、普通对象、数组、Map/Set、Date/RegExp、二进制视图和 File/Blob。数组的连续元素使用按位置编码，空洞后的元素和自定义属性保留显式键。

自定义资源实例应放入 Session cache。协议面向可信 Worker；它不提供操作系统层面的不可信代码隔离。

## 分块消费选项

`iterateResults` 接收 `next(signal)`、`isDone(value)`、`close()` 和可选外部 signal。`next` 返回 TaskHandle、null 或其 Promise。上一块租约先释放，再发起下一次拉取。

迭代器提供 `closed`、`dispose()`、`retryCleanup()`。`close` 失败可重试，但首次 closed 的拒绝保持可观察。两阶段选项的完整类型见源码链接，使用步骤见[文件与分块](/docs/guides/files/)。

## 源码与契约

- [src/binary.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/binary.ts)
- [src/packet.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/packet.ts)
- [src/iterate-results.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/iterate-results.ts)
- [src/sized-results.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/sized-results.ts)
- [src/sized-source.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/sized-source.ts)
