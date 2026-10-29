---
title: "资源调度与内存压力"
linkTitle: "资源调度与内存压力"
description: "配置交互预留、缓存维护和可选自适应目标。"
weight: 50
doc_type: how-to
---

需要保障交互任务的准入容量时，配置 `interactiveReserve`。预留可以覆盖 Worker、活跃任务、准备窗口、结果租约和各类字节额度。

## 配置交互预留

预留不能超过 Runtime 总容量。非交互任务不能占用这部分容量；交互任务仍需同时满足 Pool 和预算等其他约束。Pool 的 `interactiveWorkers` 进一步设置其非交互不可用的槽位。

单纯提高任务优先级不会凭空增加 Worker 或字节额度。先观察 `runtime.diagnostics()` 的具体阻塞原因，再调整预留和分块大小。

## 执行维护

`resizePool(pool, sizing)` 在构造时的硬上限内调整目标。`setMemoryPressure('normal' | 'moderate' | 'critical')` 设置内存压力级别，`trim(options)` 请求清理。

缓存缩容在业务物理任务结束后执行，收到 Host 确认才归还额度。Session、持有结果和失败清理会保护相应资源。`MaintenanceReport.failures` 应作为后续重试和告警的依据。

## 启用自适应

Pool 的 `adaptive` 是显式启用的反馈控制器。它在 `size` 与 `cacheBytes` 的硬上限内调整 Worker 和缓存目标，考虑空闲滞后与内存压力。

自适应调节不会测量全部 JS、WASM 或 native 内存。上线时保留业务内存采样，并以实际任务和设备观察是否改善响应性。

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [docs/resource-scheduling.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resource-scheduling.md)
