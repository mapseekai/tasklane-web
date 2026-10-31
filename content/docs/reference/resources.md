---
title: "Scope、Session 与资源"
linkTitle: "Scope、Session 与资源"
description: "查询 RuntimeScope、WorkerSession、SessionGroup、ResourceLease 与动态维护接口的参数与返回值。"
weight: 30
doc_type: reference
---

`RuntimeScope` 用于组织业务生命周期边界，`WorkerSession` 用于独占绑定单个物理 Worker，`SessionGroup` 用于在已打开的多副本会话间路由任务，`ResourceLease` 用于管理独立于单次任务的常驻字节额度。

## 生命周期与会话管理方法

| 调用方法 | 返回值类型 | 功能与清理契约 |
| --- | --- | --- |
| `runtime.createScope(label?)` | `RuntimeScope` | 创建根级业务作用域（受全局 `maxScopes` 限制） |
| `runtime.withScope(label, fn)` | `Promise<T>` | 创建临时 `Scope` 执行回调 `fn(scope)`，并在 `finally` 中自动等待 `scope.dispose()` 完成 |
| `scope.createScope(label?)` | `RuntimeScope` | 在当前 `Scope` 下创建嵌套子作用域；父作用域销毁时会一并销毁所有子作用域 |
| `scope.session(pool, options?)` | `WorkerSession` | 创建惰性会话（初始状态为 `'unbound'`，在首个任务准入时绑定物理 Worker） |
| `scope.acquireSession(pool, options?)` | `Promise<WorkerSession>` | 立即申请 Worker 容量、完成物理启动握手（以及可选的 `residentBytes` 预留），返回已处于 `'bound'` 状态的会话 |
| `scope.sessionGroup(sessions)` | `SessionGroup` | 借用 1~128 个属于同一 Runtime / Scope / Pool 且准入优先级相同的已绑定 `Session` 组建路由组（不接管成员关闭权） |
| `scope.dispose()` | `Promise<void>` | 取消作用域内任务，释放未消费租约，关闭子 Scope 与 Session，并等待相关 Worker 返回释放确认 ACK |
| `runtime.dispose()` | `Promise<void>` | 销毁所有根 Scope 并物理终止全部受管 Worker |
| `disposeWithin(ms)` | `Promise<void>` | `runtime` 与 `scope` 均提供；仅限制调用方的等待毫秒数，超时后后台物理清理继续进行 |
| `runtime.retryTermination()` | `Promise<void>` | 对此前因 `endpoint.terminate()` 失败而处于隔离状态（`quarantinedWorkers`）的 Worker 重新尝试物理终止 |

## `SessionOptions` 与 `SessionAdmissionOptions` 字段

`scope.session(pool, options)` 接受前三个基础字段；`scope.acquireSession(pool, options)` 接受全部字段：

| 字段 | 默认值 | 说明与约束 |
| --- | --- | --- |
| `priority` | `'foreground'` | 会话的资源准入类别（`'interactive'` \| `'foreground'` \| `'background'`），同时作为会话内任务的默认优先级 |
| `reclaimable` | `false` | 设为 `true` 时，允许在池缩容、内存压力或新会话准入争用时回收处于空闲且无保护条件的会话 |
| `reclaimPriority` | `0` | 可回收会话的淘汰优先级（安全整数，**数值越小越优先被回收**，同分按最久未使用淘汰） |
| `mode` | `'wait'` | 仅 `acquireSession`：`'wait'`（排队等待容量与可回收副本释放）或 `'immediate'`（容量不足时立即抛出 `SessionAdmissionError`） |
| `residentBytes` | 不额外预留 | 仅 `acquireSession`：与 Worker 准入原子绑定的常驻内存字节数（会话关闭时自动归还） |
| `signal` | 未配置 | 仅 `acquireSession`：用于中止准入排队与启动等待的 `AbortSignal` |
| `timeoutMs` | `RuntimeOptions.queueTimeoutMs` | 仅 `acquireSession`：准入等待与 Worker 握手的超时毫秒数 |

## 常驻资源租约（`ResourceLease`）

通过 `runtime.resources.acquire(request)`、`scope.resources.acquire(request)` 或 `session.resources.acquire(request)` 同步申请常驻内存租约：

- **请求参数**：`{ kind: 'resident', bytes: number, priority?: TaskPriority }`（在 `Session` 上调用时，若会话属于受保护的 `interactive` 类别，不可降级申请非交互类别租约）。
- **`lease.resize(bytes: number): void`**：原子调整当前租约持有的字节额度；若扩容时剩余 `residentBytes` 不足则抛出 `BUDGET_EXCEEDED` 并保持原额度不变。
- **`lease.release(): void`**：归还租约持有的全部字节额度与租约名额（幂等操作；所属 Scope 或 Session 销毁完成后也会自动释放）。

## 动态容量维护与内存压力接口

以下三个维护方法均在 `Runtime` 上调用，返回 `Promise<MaintenanceReport>`（注意：并发调用维护操作会被拒绝，请按序 `await`）：

- **`runtime.resizePool(pool, { size?, cacheBytes? })`**：在构造时声明的硬上限内调整指定池的 Worker 准入目标或每 Worker 缓存容量目标。
- **`runtime.setMemoryPressure('normal' | 'moderate' | 'critical')`**：
  - `'moderate'`：将各池目标容量与缓存目标缩减至进入压力前的一半；
  - `'critical'`：将容量降至交互预留允许的下限、缓存目标降至 `0`，并立即尝试回收空闲 Worker 与可回收 `Session`；
  - `'normal'`：恢复进入压力前的目标配置。
- **`runtime.trim({ pool?, cacheBytesPerWorker?, workersPerPool?, reclaimSessions? })`**：立即向指定池（默认全部池）发起一次缓存裁剪与空闲 Worker / 可回收 `Session` 清理。

## 完整类型声明

{{< type-source "resources" >}}

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [src/resources/resident.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/resident.ts)
