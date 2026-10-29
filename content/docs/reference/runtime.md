---
title: "Runtime 与 Pool 配置"
linkTitle: "Runtime 与 Pool 配置"
description: "查询 createWorkerRuntime 的所有配置字段与默认值。"
weight: 10
doc_type: reference
---

`createWorkerRuntime<Tasks>(options)` 创建应用级 Runtime。`pools` 为必填项，每个 Pool 提供一个新建专用 WorkerEndpoint 的 factory。

## RuntimeOptions

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| `pools` | 必填 | Pool 名到配置的映射 |
| `maxWorkers` | Pool 的 size 之和 | 物理 Worker 上限 |
| `maxActiveTasks` | `min(总 size, maxWorkers)` | 启动、同步准备与执行上限 |
| `maxPreparingTasks` | `2` | 异步准备与已准备输入窗口 |
| `maxQueuedTasks` | `1024` | 等待准入队列上限 |
| `maxResultLeases` | `1024` | 已准入工作与持有结果数量上限 |
| `maxResourceLeases` | `4096` | 常驻资源租约数量上限 |
| `maxScopes` | `4096` | 根和子 Scope 总数上限 |
| `budgets` | 见下表 | Runtime 的总字节额度 |
| `startupTimeoutMs` | `10000` | Worker 启动和握手超时 |
| `queueTimeoutMs` | `120000` | 首次准入前等待超时 |
| `executionTimeoutMs` | `120000` | 准入后整个物理阶段超时 |
| `releaseTimeoutMs` | `10000` | Scope 释放确认超时 |
| `priorityPolicy` | `'strict'` | 严格优先级或 `'ageing'` |
| `ageingMs` | `2000` | 老化策略的提升间隔 |
| `budgetWaitMs` | `1000` | 预算等待保护间隔 |
| `maxAffinityEntries` | `4096` | 软亲和性历史上限 |
| `interactiveReserve` | 各项为 `0` | 交互任务专用准入容量 |
| `onDiagnostic` | 未配置 | 接收 RuntimeError 诊断，回调异常被隔离 |

## RuntimeBudgets

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| `inputBytes` | `64 MiB` | 全局任务输入 |
| `scratchBytes` | `128 MiB` | 全局任务暂存 |
| `outputBytes` | `64 MiB` | 执行中及待消费结果 |
| `cacheBytes` | `128 MiB` | 所有 Worker 已预留缓存容量 |
| `residentBytes` | `128 MiB` | 独立生命周期资源 |

MiB 为 `1024 ** 2` 字节。额度使用非负安全整数；数量和超时的最小值由对应字段校验，不能用 `Infinity` 表示无限。

## PoolOptions

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| `factory` | 必填 | 每次返回新的专用 WorkerEndpoint |
| `size` | 必填 | Worker 数量硬上限 |
| `cacheBytes` | `0` | 每 Worker 缓存容量硬上限 |
| `cacheEntries` | `4096` | 每 Worker 缓存条目数上限 |
| `allowHardCancel` | `false` | 允许显式 terminate 取消 |
| `idleTimeoutMs` | `30000` | 普通空闲 Worker 过期，`0` 禁用 |
| `interactiveWorkers` | `0` | 非交互任务不能占用的槽位 |
| `adaptive` | 未启用 | 在构造硬上限内调节目标 |

## AdaptivePoolOptions

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| `minWorkers` | `max(1, interactiveWorkers)` | 自适应 Worker 下界 |
| `minCacheBytes` | `0` | 自适应缓存下界 |
| `sampleMs` | `1000` | 采样间隔 |
| `idleMs` | `30000` | 空闲收缩滞后 |
| `missRatio` | `0.2` | 缓存未命中比例阈值，范围 `[0, 1]` |

## 完整类型

{{< type-source "runtime" >}}

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [src/resources/budget.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/budget.ts)
