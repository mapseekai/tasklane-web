---
title: "Host 与 Worker 缓存"
linkTitle: "Host 与 Worker 缓存"
description: "查询 @mapseekai/tasklane/host 的 serve、output、HostContext、ScopedCache 与 ScratchArena 接口。"
weight: 40
doc_type: reference
---

在 Worker 线程内，使用 `@mapseekai/tasklane/host` 导出的 `serve<Tasks>(port, handlers)` 注册任务处理函数（返回用于取消监听的清理函数 `() => void`）。处理函数通过 `output(value, transfer?)` 显式声明返回结果与需要转移所有权的 `ArrayBuffer` 列表。

## `HostContext` 属性与方法

每个任务处理函数 `handler(input, ctx)` 的第二个参数为 `HostContext`：

| 属性或方法 | 类型 | 用途与契约约束 |
| --- | --- | --- |
| `signal` | `AbortSignal` | 当前任务的取消信号；收到协作取消指令时变为 aborted |
| `outputLimit` | `number` | 本次任务允许返回的协议输出包最大字节数（即调用方声明的 `budget.outputBytes`） |
| `scopeId` | `string` | 提交该任务的 `Scope` 唯一标识 |
| `sessionId` | `string \| undefined` | 若通过 `Session` 提交，则为该会话的唯一标识；普通池任务为 `undefined` |
| `epoch` | `number` | 当前物理 Worker 实例的代际号 |
| `cache` | `ScopedCache` | 自动隔离到当前 `sessionId`（优先）或 `scopeId` 命名空间的本地缓存接口 |
| `scratch` | `ScratchArena` | 受本任务 `budget.scratchBytes` 上限约束的临时 `ArrayBuffer` 分配器 |
| `progress(value)` | `void` | 发送有界进度控制消息（最多 64 个对象、256 条边、`4 KiB` 计费量；Host 自动按 16ms 与 ACK 节流） |
| `checkpoint()` | `Promise<void>` | 让出一次真实宏观事件循环以接收取消消息，若已取消则立即抛出中止错误（任务结束后调用会拒绝） |

{{< type-source "host" >}}

## `ScopedCache` 与 `ScratchArena` 方法说明

### `ScopedCache`（Worker 本地缓存）

- **`get<T>(key: string): T | undefined`**：读取当前命名空间下的缓存值，命中时更新 LRU 顺序并递增 `hits`，未命中递增 `misses`。
- **`set<T>(key: string, value: T, bytes?: number): T`**：保存可被 LRU 淘汰的普通结构化数据。若显式传入 `bytes`，该值不得低于 `dataByteLength(value)` 的实际核算值。
- **`setBinary<T extends ArrayBufferView>(key: string, view: T): T`**：零拷贝保存原生 `TypedArray` 或 `DataView` 快照。不枚举数组下标、不复制底层内存，按完整底层 `ArrayBuffer` 计费，支持 LRU 淘汰（缓存持有期间切勿将底层缓冲区 `transfer` 转移走）。
- **`setPinned<T>(key: string, value: T, bytes?: number): T`**：仅在 `Session` 任务中可用；保存不会被 LRU 自动淘汰的固定普通数据。
- **`setResource<T>(key: string, value: T, bytes: number, disposer: (value: T) => void | Promise<void>, options?: CacheResourceOptions): CacheResourceLease<T>`**：仅在 `Session` 任务中可用；注册数据库句柄、WASM 实例等不透明资源，信任声明的 `bytes` 上界。可选传入 `options.trim(targetBytes)` 响应内存压力裁剪。返回 `CacheResourceLease`，可通过 `lease.report(snapshot)` 上报内部缓存命中计数与块 `keys` 足迹。
- **`delete(key: string): boolean | Promise<boolean>`**：删除指定键。若条目为注册了异步 `disposer` 的不透明资源，则返回 Promise，调用方在替换同名资源前必须 `await ctx.cache.delete(key)`。
- **`clear(): void | Promise<void>`**：清空当前命名空间下的所有条目并等待所有 `disposer` 完成。

### `ScratchArena`（任务内受控暂存）

- **`ctx.scratch.allocate(bytes: number): ArrayBuffer`**：在当前任务的 `scratchBytes` 额度内分配一块新的 `ArrayBuffer`；累计未释放字节超过上限时抛出 `BUDGET_EXCEEDED`。
- **`ctx.scratch.release(buffer: ArrayBuffer | ArrayBufferView): void`**：立即 `detach` 回收该临时缓冲区并归还当前任务的暂存可用额度。任务结束时，Arena 中所有尚未手动释放的缓冲区均会被自动 `detach` 关闭。

{{< type-source "cache" >}}

## 源码与契约

- [src/host.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/host.ts)
- [src/resources/cache.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/cache.ts)
- [src/resources/scratch.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/scratch.ts)
