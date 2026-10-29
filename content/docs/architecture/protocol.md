---
title: "协议与故障隔离"
linkTitle: "协议与故障隔离"
description: "理解版本握手、Worker 代际和释放确认。"
weight: 20
doc_type: explanation
---

Runtime 与 Host 使用协议 v7。启动时交换 hello / ready，Worker 上报其处理任务列表；消息携带 epoch，以区分同一槽位内不同物理 Worker。

## 消息族

| 消息 | 方向 | 目的 |
| --- | --- | --- |
| `hello` / `ready` | 双向握手 | 版本与任务能力 |
| `request` | Runtime 到 Host | 任务、Packet、输出与 scratch 上界 |
| `result` / `error` / `cancelled` | Host 到 Runtime | 物理任务终态 |
| `progress` / `progress-ack` | 双向 | 有界进度流 |
| `cancel` | Runtime 到 Host | 协作取消 |
| `release-scope` / `released` | 双向 | Scope 资源释放屏障 |
| `cache-control` / `cache-controlled` | 双向 | 缓存维护和容量确认 |

## 进度边界

progress 使用至多 4 KiB 的小型控制数据，每个物理任务至多一条在途，等待 ACK 时保留最新快照。Host 发送间隔至少 16 ms，数据块应通过有输出额度的结果传递。

## 物理确认

Scope 释放按 Scope ID 和 epoch 等待 ACK。缓存缩容的额度也在确认后归还。迟到消息不能释放新一代 Worker 的资源。

物理终止失败时 Worker 保持隔离并继续占用容量，应用通过诊断与 `retryTermination` 处理。Runtime 面向可信端点；消息在平台反序列化后才进入运行时校验，需要隔离不可信算法时使用具备操作系统资源限制的进程或服务。

## 源码与契约

- [src/protocol.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/protocol.ts)
- [src/progress.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/progress.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [src/host.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/host.ts)
