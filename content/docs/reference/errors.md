---
title: "错误码"
linkTitle: "错误码"
description: "查询 RuntimeError.code 的全部 16 个稳定错误码、触发条件、remoteError 远端异常结构与 SessionAdmissionError 原因码。"
weight: 70
doc_type: reference
---

`tasklane` 抛出的所有运行时与任务异常均为 `RuntimeError` 实例。其中 `error.code`（类型为 `ErrorCode`）是面向业务分支判断的**稳定编程契约**，而 `error.message` 仅用于人类可读的日志诊断。

## 16 个稳定 `ErrorCode` 对照表

| `RuntimeError.code` | 触发原因 | 推荐处置方式 |
| --- | --- | --- |
| `'ABORTED'` | 任务、会话准入或迭代器被 `cancel()`、`AbortSignal` 或 `Scope.dispose()` 主动中止 | 检查取消原因；在视口切换或用户取消场景下通常直接忽略 |
| `'CLOSED'` | 向已经调用了 `dispose()` 的 `Runtime`、`Scope`、`Session` 或迭代器提交操作 | 检查业务对象生命周期，确保在未关闭的有效 `Scope` 上提交任务 |
| `'QUEUE_FULL'` | 等待准入的任务数量已达到 `RuntimeOptions.maxQueuedTasks`（默认 `1024`） | 缩小上游生产者的并发提交窗口，或配合 `iterateResults` 按消费速度拉取 |
| `'QUEUE_TIMEOUT'` | 任务等待首次准入（或 `acquireSession` 等待容量）超过了 `queueTimeoutMs` | 检查 `runtime.diagnostics().waitingReasons`，排查是否有未释放的 `ResultLease` 或独占 `Session` 堵住容量 |
| `'EXECUTION_TIMEOUT'` | 任务获得准入后，准备、启动或 Worker 执行耗时超过了 `executionTimeoutMs` | 检查算法是否在超大分块上耗时过长，或 `prepareAsync` 是否挂起；已发往 Worker 的超时任务会触发物理线程终止 |
| `'STARTUP_TIMEOUT'` | 新建物理 Worker 在 `startupTimeoutMs`（默认 `10000` ms）内未完成 `hello / ready` 握手 | 检查浏览器 Network 面板中 Worker URL 是否 404，或 Worker 顶层模块初始化是否阻塞 |
| `'WORKER_FAILED'` | 物理 Worker 触发未捕获异常、意外崩溃退出，或 `endpoint.terminate()` 清理失败 | 检查 Worker 内部崩溃原因；若是状态型计算，需重建 `Session` |
| `'PROTOCOL_ERROR'` | 收到非法协议消息、协议版本不匹配（非 `v7`），或在非 Worker 线程调用了 `nodeHost()` | 确保主线程包与独立构建的 Worker 产物使用完全相同版本的 `@mapseekai/tasklane` |
| `'UNKNOWN_TASK'` | 提交的任务名称未在目标 Worker 的 `serve(port, handlers)` 中注册 | 核对 `enqueue` 的任务名与目标 Pool 所指向的 Worker 脚本是否一致 |
| `'BUDGET_EXCEEDED'` | 声明的预算超过全局/类别上限，或实际编码的 `Packet`、`blobLimits`、`scratch`、缓存、`maxScopes` 超出限额 | 核对错误消息中的具体超限项；为复合对象预留元数据余量，或为非空文件附件显式配置 `blobLimits` |
| `'INVALID_ARGUMENT'` | 配置项或参数不合法（如负数预算、非安全整数、`prepare` 返回了 Promise、`transferBuffers` 传入了局部切片） | 根据堆栈修正调用参数类型与数值范围 |
| `'SESSION_LOST'` | `WorkerSession` 绑定的物理 Worker 已崩溃或被终止（或 `SessionGroup` 所有成员均已失效） | 销毁旧 `Session`，申请新 `Session` 并重新执行数据源打开/初始化流程 |
| `'HARD_CANCEL_DENIED'` | 任务指定了 `cancellation: 'terminate'`，但目标 Pool 未开启 `allowHardCancel: true`（或任务位于 `Session` 中） | 将取消模式改为 `'cooperative'` / `'discard'`，或在专用计算池上显式开启 `allowHardCancel: true` |
| `'RESULT_RELEASED'` | 在 `ResultLease` 已经调用 `release()`（或退出 `consumeResult` 回调）后再次访问 `lease.value` | 只在 `consumeResult` 回调内部或 `lease.release()` 之前读取结果值 |
| `'REMOTE_ERROR'` | Worker 内的业务处理函数（或缓存资源 `disposer` / `trim`）抛出了异常 | 读取 `error.remoteError` 获取远端业务错误的 `name`、`code`、`message` 与 `details` |
| `'CAPACITY_UNAVAILABLE'` | `scope.acquireSession` 在无法满足所需容量（如 `mode: 'immediate'` 或池已无健康可回收容量）时拒绝 | 捕获 `SessionAdmissionError` 并读取 `error.reasons` 数组定位具体短缺资源 |

## 远端业务错误（`error.remoteError`）

当 `error.code === 'REMOTE_ERROR'` 时，`error.remoteError`（类型为 `RemoteErrorInfo`）包含经过安全净化与边界截断后的 Worker 侧异常信息：

- **`name: string`**：原始错误名称（最长 `128` 字符）。
- **`code?: string`**：若原 Error 对象带有字符串类型的 `.code` 属性则保留（最长 `128` 字符）。
- **`message: string`**：原始错误消息（最长 `1024` 字符）。
- **`stack?: string`**：原始调用栈文本（最长 `4096` 字符）。
- **`details?: unknown`**：若原 Error 对象带有 `.details` 属性，且仅包含有限数字、字符串、布尔值、`null`、普通对象与数组（最多 `8` 层深度、`128` 次访问、`4 KiB` 计费量），则完整传回；若超出限制或包含非法类型，则省略该字段并将 **`detailsOmitted`** 置为 `true`。
- **`truncated?: boolean`**：当 `name`、`code`、`message` 或 `stack` 发生长度截断时为 `true`。

## 会话准入拒绝原因（`SessionAdmissionError.reasons`）

当 `scope.acquireSession()` 以 `CAPACITY_UNAVAILABLE` 失败时，抛出的 `SessionAdmissionError`（继承自 `RuntimeError`）额外带有 `reasons: readonly SessionUnavailableReason[]` 数组，可能包含以下一项或多项原因：

- `'pool-capacity'`：目标 Pool 的 Worker 数量已达上限且无空闲可回收副本；
- `'global-workers'`：Runtime 全局物理 Worker 数量已达 `maxWorkers` 上限；
- `'cache-budget'`：全局剩余 `cacheBytes` 不足以预留新 Worker 所需的缓存容量；
- `'resident-budget'`：全局剩余 `residentBytes` 不足以满足请求的常驻字节数；
- `'resource-leases'`：常驻资源租约数量已达 `maxResourceLeases` 上限；
- `'interactive-reserve'`：非交互会话请求的资源会侵占专为 `'interactive'` 预留的保护容量。

## 源码与契约

- [src/errors.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/errors.ts)
- [src/remote-error.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/remote-error.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
