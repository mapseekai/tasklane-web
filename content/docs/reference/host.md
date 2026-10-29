---
title: "Host 与 Worker 缓存"
linkTitle: "Host 与 Worker 缓存"
description: "查询 Worker 任务处理端和缓存资源接口。"
weight: 40
doc_type: reference
---

`serve<Tasks>(port, handlers)` 在 Worker 内注册任务，并返回停止监听的函数。handler 返回 `output(value, transfer?)`，以显式描述结果与转移对象。

## HostContext

| 字段或方法 | 返回值 | 用途 |
| --- | --- | --- |
| `signal` | AbortSignal | 协作取消 |
| `outputLimit` | number | 生成结果前可用的协议输出上界 |
| `scopeId` | string | Scope 命名空间 |
| `sessionId` | string 或 undefined | Session 命名空间 |
| `epoch` | number | 物理 Worker 代际 |
| `cache` | ScopedCache | 作用域隔离的本地缓存 |
| `scratch` | ScratchArena | 受任务额度限制的临时 buffer |
| `progress(value)` | void | 受限的进度控制消息 |
| `checkpoint()` | Promise<void> | 让出事件循环并检查取消 |

{{< type-source "host" >}}

## ScopedCache

`get` 读取缓存，`set` 保存可淘汰普通数据，`setBinary` 保存原生二进制视图，`setPinned` 固定普通数据。`setResource` 用于 Session 内的不透明实例，必须声明费用与 disposer。

`delete` 可能返回 Promise，调用方应 `await`。不透明资源的销毁成功前继续持有额度，失败可重试。`CacheResourceLease.report` 提交绝对计数器和完整替换的 key 快照。

{{< type-source "cache" >}}

## 源码与契约

- [src/host.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/host.ts)
- [src/resources/cache.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/cache.ts)
- [src/resources/scratch.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/scratch.ts)
