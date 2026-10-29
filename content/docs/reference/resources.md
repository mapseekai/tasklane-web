---
title: "Scope、Session 与资源"
linkTitle: "Scope、Session 与资源"
description: "查询生命周期操作、会话准入与维护接口。"
weight: 30
doc_type: reference
---

Scope 聚合业务资源，Session 绑定独占 Worker，ResourceLease 为任务外资源预留额度。关闭调用返回的 Promise 表示实际清理结果。

## 生命周期操作

| 操作 | 返回值 | 用途 |
| --- | --- | --- |
| `runtime.createScope(label?)` | RuntimeScope | 创建根 Scope |
| `runtime.withScope(label, callback)` | Promise | 在回调后清理 Scope |
| `scope.createScope(label?)` | RuntimeScope | 创建子 Scope |
| `scope.session(pool, options?)` | WorkerSession | 创建惰性绑定会话 |
| `scope.acquireSession(pool, options?)` | Promise<WorkerSession> | 提前申请并启动 Worker |
| `scope.sessionGroup(sessions)` | SessionGroup | 借用已绑定副本进行路由 |
| `scope.dispose()` | Promise<void> | 清理其任务、结果与所有子资源 |
| `runtime.dispose()` | Promise<void> | 关闭 Runtime |
| `disposeWithin(ms)` | Promise<void> | 仅限制调用者等待期限 |
| `runtime.retryTermination()` | Promise<void> | 重试失败的物理 Worker 终止 |

## Session 准入

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| `priority` | `'foreground'` | 资源准入类别和会话任务默认优先级 |
| `reclaimable` | `false` | 允许回收符合空闲条件的会话 |
| `reclaimPriority` | `0` | 数值较小者优先回收 |
| `mode` | `'wait'` | 等待容量，或 `'immediate'` 立即反馈 |
| `residentBytes` | 不额外预留 | 与 Worker 准入同时申请常驻额度 |
| `signal` | 未配置 | 中止准入等待 |
| `timeoutMs` | Runtime queueTimeoutMs | 覆盖等待和启动 |

## ResourceLease

通过 `runtime.resources.acquire`、`scope.resources.acquire` 或 `session.resources.acquire` 申请 `{ kind: 'resident', bytes, priority? }`。租约的 `resize(bytes)` 原子调整额度，失败保持原值；`release()` 归还额度。

## 维护操作

`resizePool(name, { size?, cacheBytes? })`、`setMemoryPressure(level)` 和 `trim(options?)` 返回 `Promise<MaintenanceReport>`。构造配置保留为硬上限，维护目标不会越过它。

{{< type-source "resources" >}}

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [src/resources/resident.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/resident.ts)
