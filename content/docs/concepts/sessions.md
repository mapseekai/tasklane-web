---
title: "Affinity 与 Session"
linkTitle: "Affinity 与 Session"
description: "按状态能否重建选择软亲和性或独占 Worker。"
weight: 60
doc_type: explanation
---

可重建缓存使用 affinity，必须绑定同一执行环境的状态使用 Session。Session 一旦绑定，会独占 Worker 槽位，直到关闭或 Worker 失效。

| 机制 | 保证 | 适用状态 |
| --- | --- | --- |
| `affinity` | 有界历史中的优先选择 | 可重新计算的块缓存、字形缓存 |
| `Session` | 绑定独占 Worker | 数据库句柄、数据集、WASM 实例 |
| `SessionGroup` | 在调用方已打开的副本中路由 | 支持相同业务请求的读取副本 |

## 创建与准入

`scope.session(pool)` 创建惰性会话，首个任务时绑定。`scope.acquireSession(pool, options)` 提前完成 Worker 准入和启动，并可同时预留常驻额度。

Worker 丢失后会话进入 `lost`。应用负责重新打开数据库、数据集和其他状态。不要将 affinity 当作必须保留状态的约束。

## 关闭与回收

Session 默认保留状态。显式设置 `reclaimable: true` 后，空闲且没有排队任务、持有结果等保护条件的会话才可参与回收。

SessionGroup 借用同一 Runtime、Scope、Pool 和准入优先级的已绑定成员。调用方负责初始化与关闭各成员，组负责在可用副本间选路。操作示例见[状态型计算](/docs/guides/sessions/)。

## 源码与契约

- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [docs/resource-scheduling.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resource-scheduling.md)
