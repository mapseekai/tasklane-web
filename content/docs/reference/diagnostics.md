---
title: "指标与诊断类型"
linkTitle: "指标与诊断类型"
description: "查询 runtime.stats、runtime.diagnostics()、runtime.resourceDiagnostics() 与 TaskTiming 的完整数据结构与统计口径。"
weight: 80
doc_type: reference
---

`WorkerRuntime` 提供三个只读观测接口，分别返回不同粒度的不可变快照：

- **`runtime.stats: RuntimeStats`**：高频读取的全局状态计数、五类预算预留量、峰值、缓存命中率、调度器唤醒次数与回收统计。
- **`runtime.diagnostics(): RuntimeDiagnostics`**：按 Pool 展开的容量目标、已绑定会话、上报的不透明资源列表以及当前排队任务的具体阻塞原因计数（`waitingReasons`）。
- **`runtime.resourceDiagnostics(): ResourceDiagnostics`**：用于深度排障的明细快照，列出当前仍在 `preparing` / `prepared` 的任务 ID、隔离中的 Worker 槽位、未释放的常驻租约与结果租约计数。

## 关键统计口径说明

1. **`reserved`、`peakReserved` 与 `preparationReserved`**：
   - `reserved` 表示当前时刻账本已预留的五类字节数，`peakReserved` 为自 Runtime 创建以来的历史最高预留峰值；
   - `preparationReserved` 展示当前处于 `preparing` 与 `prepared` 阶段的任务所占用的字节预算——**该数值已经包含在 `reserved` 总量中，切勿将两者重复相加**。
2. **`cacheReservedBytes` 与 `cacheUsedBytes`**：
   - `reserved.cacheBytes`（以及每池的 `cacheReservedBytes`）是存活 Worker 向全局账本预留的缓存容量上限；
   - `cacheUsedBytes` 是各 Worker 根据最近一次协议消息上报的实际已用缓存字节数。
3. **`cacheStats` 与 `resourceCacheStats`**：
   - `cacheStats` 统计 Worker 本地 `ScopedCache`（`get` / `set` / `setBinary` / `setPinned`）的累计命中（`hits`）、未命中（`misses`）与 LRU 淘汰（`evictions`）次数；
   - `resourceCacheStats` 汇总由不透明资源通过 `CacheResourceLease.report()` 自报的内部块缓存累计指标。
4. **`reclaim` 与 `workerTerminations`**：
   - `reclaim` 统计因容量争用（`capacity` / `resident`）、内存压力（`pressure`）、手动调整（`resize`）或自适应收缩（`adaptive`）触发的回收尝试、成功与失败次数；
   - 正常的 `dispose()`、普通空闲过期（`idleTimeoutMs`）以及 `retryTermination()` 不计入 `reclaim`，所有物理线程终止统一记录在 `workerTerminations` 中。
5. **`TaskTiming` 各阶段毫秒数**：
   - `queueMs`（入队到准入）、`startupMs`（首次 Worker 启动握手）、`prepareMs`（调用线程输入准备）、`roundTripMs`（请求发出到收到响应，含跨线程传输与 Worker 执行）、`workerMs`（Worker 处理函数内部纯执行耗时）与 `totalMs`（从入队到任务结束的总耗时）。

## 完整类型声明

{{< type-source "diagnostics" >}}

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/resources/telemetry.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/telemetry.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
