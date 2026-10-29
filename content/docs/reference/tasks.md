---
title: "任务与结果接口"
linkTitle: "任务与结果接口"
description: "查询提交选项、准备阶段、句柄与结果租约。"
weight: 20
doc_type: reference
---

`scope.enqueue(name, options)` 提交同步输入任务；`scope.enqueuePrepared(name, options)` 提交异步输入准备任务。两者立即返回 `TaskHandle`。

## TaskOptions

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| `pool` | 必填 | 目标 Pool 名 |
| `budget` | 必填 | input、scratch、output 上界 |
| `prepare` | 必填 | 调用线程内的同步输入构造 |
| `priority` | `'foreground'` | 任务准入优先级，Session 可继承其类别 |
| `group` | 未显式指定 | Scope 内公平服务分组 |
| `affinity` | 未配置 | 字符串或多 key 的软亲和性 |
| `cancellation` | `'cooperative'` | 取消方式 |
| `signal` | 未配置 | 外部中止信号 |
| `blobLimits` | 输入和输出均 `0` | 每包 Blob/File 逻辑字节上限 |
| `queueTimeoutMs` | Runtime 配置 | 首次准入等待超时 |
| `executionTimeoutMs` | Runtime 配置 | 准入后的物理阶段超时 |
| `discardResult` | `false` | 成功后自动丢弃结果 |
| `onProgress` | 未配置 | 接收受限进度控制数据 |

Session 的提交选项不包含 `pool` 和 `affinity`，这两项由会话绑定确定。

## PreparedTaskOptions

此类型继承 TaskOptions，但用 `prepareAsync` 替代 `prepare`。

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| `prepareAsync` | 必填 | 取得额度后异步生产输入 |
| `preparationScratchBytes` | 必填 | 调用线程的准备临时内存上界 |
| `preparationTimeoutMs` | executionTimeoutMs | 单独限制生产回调 |

## TaskHandle 与 ResultLease

`result` 兑现成功结果租约，或拒绝为 RuntimeError。`settled` 只表示物理完成，并且不拒绝。`cancel(reason?)` 发起逻辑取消。

`lease.value` 首次访问时解码。`release()` 清除租约引用并归还额度，释放后不能再访问 value。消费推荐 `consumeResult(handle, consume)`，其返回值为消费者的返回值。

## 完整类型

{{< type-source "tasks" >}}

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [src/index.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/index.ts)
- [src/resources/lease.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/lease.ts)
