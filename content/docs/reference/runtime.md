---
title: "Runtime 与 Pool 配置"
linkTitle: "Runtime 与 Pool 配置"
description: "查询 createWorkerRuntime、RuntimeOptions、RuntimeBudgets、PoolOptions 与 AdaptivePoolOptions 的完整字段与默认值。"
weight: 10
doc_type: reference
---

`createWorkerRuntime<Tasks>(options)` 用于创建应用级任务运行时实例。参数 `options.pools` 必须至少包含一个 Worker 池配置；每个池的 `factory` 每次调用都必须返回一个全新的专用 `WorkerEndpoint`。

## `RuntimeOptions` 字段说明

| 字段 | 默认值 | 说明与约束 |
| --- | --- | --- |
| `pools` | **必填** | Pool 名称到 `PoolOptions` 的映射表（至少配置 1 个池） |
| `maxWorkers` | 所有 Pool `size` 之和 | 全局允许同时存活的物理 Worker 数量上限（正安全整数） |
| `maxActiveTasks` | `min(总 size, maxWorkers)` | 全局允许同时处于 Worker 启动握手、同步 `prepare` 或 Worker 执行阶段的任务上限 |
| `maxPreparingTasks` | `2` | 全局允许同时处于 `prepareAsync` 生产中或已准备完毕等待 Worker 的任务窗口上限 |
| `maxQueuedTasks` | `1024` | 等待执行准入的排队任务总数上限（包含 `preparing` 与 `prepared` 阶段任务），超限抛出 `QUEUE_FULL` |
| `maxResultLeases` | `1024` | 全局同时保留的 `ResultLease` 加上已准入非丢弃任务的数量上限 |
| `maxResourceLeases` | `4096` | 全局同时持有的常驻 `ResourceLease` 数量上限 |
| `maxScopes` | `4096` | 全局同时存活的根 `Scope` 与各级子 `Scope` 总数上限，超限抛出 `BUDGET_EXCEEDED` |
| `budgets` | 见下方 `RuntimeBudgets` | 全局五类字节预算上限配置 |
| `startupTimeoutMs` | `10000` | 新建物理 Worker 从创建到完成 `hello / ready` 握手的超时毫秒数 |
| `queueTimeoutMs` | `120000` | 任务从入队到首次获得准入（或 `acquireSession` 等待容量）的默认超时毫秒数 |
| `executionTimeoutMs` | `120000` | 任务获得准入后覆盖准备、等待 Worker、启动与执行全过程的默认超时毫秒数 |
| `releaseTimeoutMs` | `10000` | 等待 Worker 返回 Scope 释放确认（`released`）或缓存控制确认的超时毫秒数 |
| `priorityPolicy` | `'strict'` | 优先级策略：`'strict'`（严格按优先级准入）或 `'ageing'`（随等待时间跨级提升） |
| `ageingMs` | `2000` | 当 `priorityPolicy: 'ageing'` 时，排队任务每提升一级所需的等待毫秒数 |
| `budgetWaitMs` | `1000` | 已具备物理槽位条件的候选任务因字节预算不足等待满该毫秒数后，开启短缺预算防饥饿保护 |
| `maxAffinityEntries` | `4096` | 每个 Scope 记录软亲和性（`affinity`）成功执行历史的最大条目数 |
| `interactiveReserve` | 各项为 `0` | 为 `'interactive'` 类别专门保留的 Worker、活跃槽位、准备窗口、结果租约及字节额度（不可超过对应全局上限） |
| `onDiagnostic` | 未配置 | 接收后台异步 `RuntimeError` 诊断事件的回调函数；回调内部抛出的异常会被 Runtime 自动隔离 |

## `RuntimeBudgets` 字段说明

以下五类字节预算均要求为非负安全整数（`Number.isSafeInteger`），不支持传入 `Infinity`（表中的 `MiB` 等于 `1024 ** 2 = 1,048,576` 字节）：

| 字段 | 默认值 | 说明与计费范围 |
| --- | --- | --- |
| `inputBytes` | `64 MiB` | 全局任务输入包总额度（覆盖唯一二进制 backing store、对象图元数据与附件引用费） |
| `scratchBytes` | `128 MiB` | 全局任务执行暂存总额度（含 `enqueuePrepared` 准备阶段临时申请的 `preparationScratchBytes`） |
| `outputBytes` | `64 MiB` | 全局正在执行的任务与尚未释放的 `ResultLease` 合计持有的输出包总额度 |
| `cacheBytes` | `128 MiB` | 全局所有存活 Worker 已预留的本地缓存容量总和 |
| `residentBytes` | `128 MiB` | 全局通过 `resources.acquire` 或 `acquireSession({ residentBytes })` 预留的常驻资源总额度 |

## `PoolOptions` 字段说明

| 字段 | 默认值 | 说明与约束 |
| --- | --- | --- |
| `factory` | **必填** | `() => WorkerEndpoint`，每次调用创建并返回一个新的专用 Worker 端点 |
| `size` | **必填** | 该池允许创建的物理 Worker 数量硬上限（正安全整数） |
| `cacheBytes` | `0` | 该池每个物理 Worker 的本地缓存字节容量硬上限（非负安全整数） |
| `cacheEntries` | `4096` | 该池每个物理 Worker 本地缓存的最大条目数上限 |
| `allowHardCancel` | `false` | 是否允许在该池上提交 `cancellation: 'terminate'` 的硬取消任务 |
| `idleTimeoutMs` | `30000` | 普通空闲 Worker 自动销毁的超时毫秒数；设为 `0` 则禁用空闲过期（绑定了 `Session` 的 Worker 不受此超时影响） |
| `interactiveWorkers` | `0` | 池内专门保留给 `'interactive'` 任务或会话的 Worker 槽位数（非交互工作不可占用） |
| `adaptive` | 未启用 | 可选的 `AdaptivePoolOptions` 配置，在 `[min, max]` 硬上限范围内根据负载动态调节目标容量 |

## `AdaptivePoolOptions` 字段说明

当在 `PoolOptions` 中配置了 `adaptive` 对象时，池的初始准入目标从下界开始，按采样周期动态伸缩：

| 字段 | 默认值 | 说明与约束 |
| --- | --- | --- |
| `minWorkers` | `max(1, interactiveWorkers)` | 自适应调节的 Worker 数量下界（不可超过 `PoolOptions.size`） |
| `minCacheBytes` | `0`（或硬上限的四分之一） | 自适应调节的每 Worker 缓存容量下界（不可超过 `PoolOptions.cacheBytes`） |
| `sampleMs` | `1000` | 队列积压与缓存未命中率的采样周期毫秒数 |
| `idleMs` | `30000` | 池持续空闲满该毫秒数后，将目标容量与缓存目标收缩回下界 |
| `missRatio` | `0.2` | 触发缓存扩容的未命中率阈值，取值范围 `[0, 1]` |

## 完整类型声明

{{< type-source "runtime" >}}

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [src/resources/budget.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/budget.ts)
