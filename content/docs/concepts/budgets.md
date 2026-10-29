---
title: "资源预算"
linkTitle: "资源预算"
description: "区分任务额度、缓存额度和常驻资源额度。"
weight: 30
doc_type: explanation
---

Runtime 在执行前预留声明的上界，并在协议发送前校验数据计费量。任务声明输入、暂存和输出三项预算；Runtime 还管理缓存与独立常驻资源。

| 额度 | 持有者 | 归还时机 |
| --- | --- | --- |
| `inputBytes` | 已准入任务 | 物理任务或准备阶段结束 |
| `scratchBytes` | 已准入任务 | 物理任务或准备阶段结束 |
| `outputBytes` | 执行中的任务，随后是结果租约 | 失败、丢弃或租约释放 |
| `cacheBytes` | Worker 缓存容量 | 缩容收到 ACK，或物理终止完成 |
| `residentBytes` | 显式 ResourceLease | 租约缩小、释放或所属生命周期完成清理 |

## 协议字节与实际内存

`packetByteLength(value)` 计入协议元数据、字符串和完整二进制 backing store。根 TypedArray 直接按完整 backing store 计费；复合对象需要额外元数据空间。这个函数会完整编码输入，不适合在每次发送前重复估算大型对象。

File/Blob 的逻辑内容由 `blobLimits` 单独限制。增大 `budget.inputBytes` 不会解除 Blob 输入限制。详见[文件与分块](/docs/guides/files/)和[计费参考](/docs/reference/data/)。

## 暂存与常驻资源

`ctx.scratch.allocate(bytes)` 管理受任务上限约束的临时 ArrayBuffer。任务结束会关闭 scratch arena。普通 `new`、JSON 解析、WASM/native/GPU 分配由业务代码负责。

独立生命周期的资源使用 `resources.acquire({ kind: 'resident', bytes })`。所有者先销毁实际数据，再释放租约。声明额度不会自动限制进程 RSS；上线前需要测量算法峰值和运行环境开销。

## 源码与契约

- [src/resources/budget.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/budget.ts)
- [src/resources/scratch.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/scratch.ts)
- [src/resources/resident.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/resident.ts)
- [docs/resources.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resources.md)
