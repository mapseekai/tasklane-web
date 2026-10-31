---
title: "数据计费与消费工具"
linkTitle: "数据计费与消费工具"
description: "查询 packetByteLength、binaryByteLength、dataByteLength、transferBuffers、consumeResult 与流式迭代器的签名与边界。"
weight: 50
doc_type: reference
---

`@mapseekai/tasklane`（以及 `@mapseekai/tasklane/host`）提供了一组用于数据大小核算、`Transferable` 所有权校验和结果消费的工具函数。

## 数据计量、转移与消费函数

| 函数签名 | 返回值 | 用途与计费口径 |
| --- | --- | --- |
| `packetByteLength(value)` | `number` | 计算跨线程传输协议包（`Packet`）的精确计费字节数（含唯一二进制 backing store、对象图元数据及附件引用费）。**注意**：内部会完整执行一次编码遍历，请勿在高频发送前对超大对象重复调用 |
| `binaryByteLength(value, limits?)` | `number` | 统计值中引用的所有唯一二进制 backing store（`ArrayBuffer` / `SharedArrayBuffer`）字节总和 |
| `dataByteLength(value, limits?)` | `number` | 计算普通驻留数据（如 `ctx.cache.set`）的计费大小：含唯一 backing store、UTF-16 字符串、数字/布尔标量、属性键名，并为每个非二进制容器对象加收 `16` 字节结构费 |
| `transferBuffers(...values)` | `ArrayBuffer[]` | 提取并去重完整拥有的 `ArrayBuffer`。若传入局部子视图（`byteOffset !== 0` 或未覆盖整个 buffer）或 `SharedArrayBuffer`，立即抛出 `INVALID_ARGUMENT` |
| `transferOwnedBuffers(...values)` | `ArrayBuffer[]` | `transferBuffers` 的语义别名 |
| `consumeResult(handle, consume)` | `Promise<R>` | 等待 `handle.result` 并将 `lease.value` 传给 `consume`，在 `finally` 中确保调用 `lease.release()` |
| `iterateResults(options)` | `ResultIterator<T>` | 将分块拉取任务封装为异步可迭代对象，保证在上一块租约释放后再发起下一块请求 |
| `iterateSizedResults(options)` | `ResultIterator<T>` | 客户端两阶段可变大小分块迭代器：先调用 `describe` 获取下一块字节上界，再按实际大小预留 `outputBytes` 调用 `read` |
| `createSizedResultSource(options)` | `SizedResultSource` | Worker 端（`@mapseekai/tasklane/host` 导出）配合 `iterateSizedResults` 使用的两阶段数据源状态机 |

## `Packet` 默认编码上限

跨线程传输的输入与输出 `Packet` 均受以下内置图边界保护（超出任何一项均抛出 `BUDGET_EXCEEDED` 或 `INVALID_ARGUMENT`）：

- **最大对象数（`maxObjects`）**：`100,000`
- **最大图遍历边数（`maxEdges`）**：`1,000,000`
- **最大独立二进制缓冲区数（`maxBuffers`）**：`4,096`
- **最大独立 `File` / `Blob` 附件数（`maxBlobs`）**：`256`（非空附件的逻辑字节总和另由任务的 `blobLimits` 校验）
- **最大图元数据与附件引用费（`maxMetadataBytes`）**：`64 MiB`

支持的数据类型包括：基本标量（`string`、`number`、`bigint`、`boolean`、`undefined`、`null`）、普通对象、数组（连续前缀按位置编码，保留空洞与自定义属性）、`Map`、`Set`、`Date`、`RegExp`、`ArrayBuffer`、`SharedArrayBuffer`、各类 `TypedArray` / `DataView` 以及 `Blob` / `File`。函数、`Symbol`、`WeakMap` / `WeakSet`、DOM 节点或带自定义原型链的类实例不支持直接放入 `Packet`（状态型实例应保存在 Worker 本地 `ctx.cache.setResource` 中）。

## `iterateResults` 与 `ResultIterator` 契约

- **`options.next(signal: AbortSignal)`**：返回下一块的 `TaskHandle<T>`、`null`（表示结束）或其 Promise。
- **`options.isDone(value: T): boolean`**：判断当前返回的块是否为结束标记（若返回 `true`，该块会自动释放租约且不会 `yield` 给消费者）。
- **`options.close(): void | Promise<void>`**：当迭代正常跑完、消费者 `break` / 抛错、调用 `iterator.dispose()` 或外部 `signal` 中止时执行的清理函数。
- **`iterator.closed: Promise<void>`**：代表当前在途物理请求结束且首次 `close()` 执行完毕的 Promise（若 `close()` 失败则拒绝）。
- **`iterator.dispose(): Promise<void>`**：主动终止迭代并等待清理完成。
- **`iterator.retryCleanup(): Promise<void>`**：当首次 `close()` 失败后，等待在途任务 `settled` 并重新调用 `close()`；重试成功后 `dispose()` 亦随之兑现。

## 源码与契约

- [src/binary.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/binary.ts)
- [src/packet.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/packet.ts)
- [src/iterate-results.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/iterate-results.ts)
- [src/sized-results.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/sized-results.ts)
- [src/sized-source.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/sized-source.ts)
