---
title: "架构设计"
linkTitle: "架构设计"
description: "一张图看懂 tasklane 内部是如何把主线程的排队管账与 Worker 线程的专注计算串起来的。"
weight: 50
doc_type: explanation
---

如果你想知道 `tasklane` 内部到底是怎么运转的，或者你想阅读源码、做深度技术选型评估，可以从这一章开始。

`tasklane` 的整体架构可以用一句话概括：**主线程当“总调度与会计”，Worker 线程当“一次只干一件事的专注工人”**。

- **在主线程（调用线程）**：集中管理所有队列优先级、五类内存账本、Worker 线程池以及业务作用域（`Scope`）的生老病死；
- **在 Worker 线程**：每个 Worker 同一时刻**最多只跑 1 个物理任务**，不需要在 Worker 内部再搞复杂的并发锁，只管专心跑完你的业务函数、管好本地缓存，并通过版本化协议（`v7`）向主线程汇报结果。

```mermaid
flowchart TB
  subgraph Caller[主线程（管排队、管账本、管生命周期）]
    A[你的业务代码] --> S[RuntimeScope：业务分组]
    S --> R[WorkerRuntime：全局总管]
    S --> SE[WorkerSession / SessionGroup]
    SE --> R
    R --> Q[Scheduler：优先级与公平排队]
    R --> B[BudgetLedger：五类内存账本]
    R --> P[Pool 与 Worker Slot]
    R --> L[ResultLease：结果租约与背压]
    L --> A
    L -->|release() 归还输出额度| B
  end
  P <-->|Packet 编码 + 显式 Transferable| X[浏览器 / Node / 测试适配器]
  subgraph Worker[Worker 后台线程（一次专心跑一个任务）]
    H[serve Host：握手 / 分发 / 校验] --> F[你的业务计算函数]
    F --> C[HostContext：signal / checkpoint / progress]
    C --> CA[ScopedCache：本地缓存与资源实例]
    C --> SC[ScratchArena：任务受控临时空间]
  end
  X <--> H
```

## 想看哪块源码？直接按这张表找

`tasklane` 没有任何外部运行时依赖，代码结构非常紧凑，上图里的每个角色都直接对应 `src/` 下的源码文件：

| 模块角色 | 源码文件位置 | 它在代码里主要干什么 |
| --- | --- | --- |
| **公共入口与类型** | `src/index.ts`、`src/types.ts` | 导出 `createWorkerRuntime` 和全部公共 TypeScript 类型定义 |
| **运行时总管** | `src/runtime/runtime.ts` | 实现 `WorkerRuntime`、`Scope`、`Session`、`SessionGroup` 以及 Worker 槽位（Slot）的状态流转 |
| **排队调度器** | `src/runtime/scheduler.ts` | 用索引堆实现三级优先级、组间轮流公平服务（`group`）和阻塞队列的定向唤醒 |
| **Worker 宿主端** | `src/host.ts` | 实现 Worker 里的 `serve()` 消息循环，组装 `ctx`（`HostContext`），检查返回值大小并执行清理 |
| **数据打包与零拷贝** | `src/packet.ts`、`src/binary.ts` | 把复杂 JS 对象图和二进制数组打包成 `Packet`（含协议 `v7` 数组按位置编码），检查 `Transferable` 所有权 |
| **内存账本与缓存** | `src/resources/` | 包含 `budget.ts`（五类预算账本）、`lease.ts`（结果租约）、`resident.ts`（常驻租约）、`cache.ts`（Worker 缓存）和 `scratch.ts`（临时空间） |
| **分块流式拉取** | `src/iterate-results.ts`、`src/sized-results.ts`、`src/sized-source.ts` | 实现 `iterateResults` 单块拉取迭代器和两阶段变长分块读取 |
| **跨平台与测试适配** | `src/adapters/`、`src/testing.ts` | 把浏览器 Web Worker、Node.js `worker_threads` 和同线程测试 `createLoopback` 统一包装成标准接口 |

## 深入阅读以下四篇解析

- **[任务执行时序](execution/)**：跟着一条任务从 `enqueue` 入队开始，一步步看它怎么经历 9 种状态、怎么锁额度、怎么在同步 `prepare` 与异步 `prepareAsync` 之间分流。
- **[协议与故障隔离](protocol/)**：看看主线程和 Worker 之间发的 7 类协议消息长什么样，为什么要用 `epoch` 代际号防串台，以及协议 `v7` 是怎么给数组编码瘦身的。
- **[资源释放边界](resources/)**：搞懂“账本预留额度”与“实际使用量”的区别，以及当关闭函数报错或线程杀不死时，系统是如何通过保守留存机制防止内存失控的。
- **[文档网站架构](website/)**：了解你现在正在看的这个静态文档站是怎么用 Hugo + OINK 构建，并通过自动化脚本保证代码例子和链接 100% 不出错的。

## 源码与契约

- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [src/runtime/scheduler.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/scheduler.ts)
- [src/host.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/host.ts)
- [docs/architecture.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/architecture.md)
