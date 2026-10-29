---
title: "任务调度"
linkTitle: "任务调度"
description: "理解优先级、公平服务与资源阻塞。"
weight: 20
doc_type: explanation
---

调度发生在任务准入时。tasklane 根据优先级、Scope/group 的服务历史和入队次序选择可执行任务；已经运行的任务不会因高优先级任务到达而被抢占。

| 优先级 | 常见用途 | 调度含义 |
| --- | --- | --- |
| `interactive` | 当前视口、当前交互 | 严格策略下优先准入 |
| `foreground` | 用户主动分析、导出 | 次于可准入的交互任务 |
| `background` | 预取、索引预热 | 严格策略下可能长期等待 |

## 严格优先级与老化

默认 `priorityPolicy: 'strict'`。启用 `'ageing'` 后，等待任务每隔 `ageingMs` 提升一级。优先级提升仍需满足 Worker、活跃槽位和资源预算条件。

同一优先级、组、Pool 或 Session 通道内保持 FIFO。不同 Pool 或 Session 的阻塞任务不应遮挡其他通道。`group` 的公平性以 Scope 和 group 的组合为单位。

## 大任务的预算等待

有物理执行条件的候选任务等待预算达到 `budgetWaitMs` 后，会保护自身短缺额度，限制同级或低级任务继续插队消耗这些额度。高优先级任务仍可使用符合其准入类别的资源。

交互资源预留和任务优先级是不同配置。需要隔离 Worker、准备窗口或字节额度时，使用[资源调度指南](/docs/guides/resource-scheduling/)。

## 源码与契约

- [src/runtime/scheduler.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/scheduler.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [docs/resources.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resources.md)
