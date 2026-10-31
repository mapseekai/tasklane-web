---
title: "任务与结果接口"
linkTitle: "任务与结果接口"
description: "查询 enqueue、enqueuePrepared、TaskOptions、PreparedTaskOptions、TaskHandle 与 ResultLease 的完整字段与行为契约。"
weight: 20
doc_type: reference
---

`scope.enqueue(name, options)` 用于提交同步构造输入的任务；`scope.enqueuePrepared(name, options)` 用于提交在绑定 Worker 之前先执行异步输入生产的任务。两者均同步返回 `TaskHandle<Output>`。

## `TaskOptions` 字段说明

| 字段 | 默认值 | 说明与约束 |
| --- | --- | --- |
| `pool` | **必填** | 目标 Worker Pool 名称（在 `Session` 上调用 `enqueue` 时无需此字段，由会话绑定决定） |
| `budget` | **必填** | `{ inputBytes, scratchBytes, outputBytes }`，声明本任务三类字节预算的非负安全整数上界 |
| `prepare` | **必填** | `(ctx: PrepareContext) => PreparedInput<Input>`，准入后在调用线程同步构造输入并返回 `{ payload, transfer? }`（返回 Promise 会以 `INVALID_ARGUMENT` 拒绝） |
| `priority` | `'foreground'` | 任务优先级：`'interactive'` \| `'foreground'` \| `'background'`（在 `Session` 内未指定时继承会话优先级） |
| `group` | 未配置 | 同一 `Scope` 内的公平调度分组标识（字符串） |
| `affinity` | 未配置 | 软亲和性提示：支持单个非空字符串，或 `{ keys: readonly string[] }`（最多 8 个非空 key，每个最长 1024 字符）。`Session` 任务不支持此字段 |
| `cancellation` | `'cooperative'` | 取消模式：`'cooperative'`（协作让出）、`'discard'`（跑完丢弃结果）或 `'terminate'`（强制终止 Worker，需池开启 `allowHardCancel`） |
| `signal` | 未配置 | 外部 `AbortSignal`，触发时等价于调用 `handle.cancel(signal.reason)` |
| `blobLimits` | `{ inputBytes: 0, outputBytes: 0 }` | 单条输入/输出消息允许携带的非空 `File` / `Blob` 附件逻辑字节总和上限 |
| `queueTimeoutMs` | `RuntimeOptions.queueTimeoutMs` | 覆盖本任务首次准入前的最长排队等待毫秒数 |
| `executionTimeoutMs` | `RuntimeOptions.executionTimeoutMs` | 覆盖本任务准入后整个物理执行阶段的最长毫秒数（已发往 Worker 的任务超时会强制物理终止 Worker） |
| `discardResult` | `false` | 设为 `true` 时不占用 `maxResultLeases` 名额，任务成功后立即自动释放输出值与 `outputBytes` 额度 |
| `onProgress` | 未配置 | `(progress: unknown) => void`，接收 Worker 通过 `ctx.progress()` 发送的有界进度快照 |

## `PreparedTaskOptions` 扩展字段

`PreparedTaskOptions` 继承自 `TaskOptions`（或者在 `Session` 上继承自 `SessionTaskOptions`），用异步 `prepareAsync` 替代同步 `prepare`：

| 字段 | 默认值 | 说明与约束 |
| --- | --- | --- |
| `prepareAsync` | **必填** | `(ctx: PrepareContext) => Promise<PreparedInput<Input>> \| PreparedInput<Input>`，在取得准备窗口名额与预算后、绑定物理 Worker 前在调用线程执行 |
| `preparationScratchBytes` | **必填** | 准备阶段在调用线程额外使用的临时内存上界（准入时按 `max(preparationScratchBytes, budget.scratchBytes)` 预留暂存额度） |
| `preparationTimeoutMs` | `executionTimeoutMs` | 单独限制 `prepareAsync` 回调执行阶段的超时毫秒数 |

## `TaskHandle` 与 `ResultLease` 属性与方法

### `TaskHandle<T>`

- **`id: string`**：运行时内唯一的任务标识符。
- **`state: TaskState`**：当前任务公开状态（`'queued'` \| `'starting'` \| `'preparing'` \| `'prepared'` \| `'running'` \| `'cancelling'` \| `'succeeded'` \| `'failed'` \| `'cancelled'`）。
- **`timing: TaskTiming`**：任务各阶段耗时统计快照。
- **`result: Promise<ResultLease<T>>`**：兑现为持有输出额度的 `ResultLease<T>`，或在任务失败/取消时以 `RuntimeError` 拒绝。
- **`settled: Promise<void>`**：当物理 Worker 执行结束（或准备阶段退栈）且 `inputBytes` / `scratchBytes` 归还后兑现；该 Promise 永不拒绝。
- **`cancel(reason?: unknown): void`**：发起逻辑取消（幂等操作）。

### `ResultLease<T>` 与 `consumeResult`

- **`lease.value: T`**：首次访问时按需解码并返回结果值；若租约已释放，访问该属性会同步抛出 `code === 'RESULT_RELEASED'` 的 `RuntimeError`。
- **`lease.byteLength: number`**：该结果占用的协议传输计费字节数。
- **`lease.released: boolean`**：指示租约是否已释放。
- **`lease.release(): void`**：清除内部值引用并向全局账本归还 `outputBytes` 额度与租约名额（幂等操作）。
- **`consumeResult(handle, consume)`**：等待 `handle.result`，将 `lease.value` 传给 `consume(value)`，并在 `finally` 中自动调用 `lease.release()`，返回 `consume` 的结果。

## 完整类型声明

{{< type-source "tasks" >}}

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [src/index.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/index.ts)
- [src/resources/lease.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/lease.ts)
