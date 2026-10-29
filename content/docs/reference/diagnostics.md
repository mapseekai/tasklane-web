---
title: "指标与诊断类型"
linkTitle: "指标与诊断类型"
description: "查询计时、运行计数和准入阻塞信息。"
weight: 80
doc_type: reference
---

`runtime.stats` 返回 Runtime 累计计数与当前预留快照。`runtime.diagnostics()` 返回资源上限、Pool 状态和等待原因。`resourceDiagnostics()` 提供准备、租约和物理清理细节。

## 读取口径

`reserved` 和 `peakReserved` 是声明额度及其峰值。`cacheUsedBytes` 是 Worker 报告的缓存使用量。`preparationReserved` 已包含在 reserved 中，不能再次相加。

缓存计数器为累计值。reader 上报的 key 列表是完整替换快照，用于 SessionGroup 路由；回收统计按 capacity、resident、pressure、resize 和 adaptive 原因分类。

`TaskTiming` 的 queueMs、startupMs、prepareMs、roundTripMs、workerMs 和 totalMs 区分任务不同阶段。它们不是进程级 CPU 或内存测量。

## 完整类型

{{< type-source "diagnostics" >}}

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/resources/telemetry.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/telemetry.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
