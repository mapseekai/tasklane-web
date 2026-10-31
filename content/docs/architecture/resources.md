---
title: "资源释放边界"
linkTitle: "资源释放边界"
description: "理解为什么 tasklane 在释放内存额度时坚持“不见兔子不撒鹰”，以及当清理报错或线程杀不死时如何守住安全底线。"
weight: 30
doc_type: explanation
---

在很多并发库里，只要你调了 `cancel()` 或 `dispose()`，计数器立马减一，表面上看起来干干净净；可实际上后台线程还没停、数据库连接还没关，新任务就踩着“虚假的空闲额度”冲了进来，最终导致内存叠加崩溃。

`tasklane` 在资源释放上坚持一条铁律：**只按物理事实退还额度，绝不靠“逻辑状态”提前销账。**

```mermaid
flowchart LR
  T[任务准入预留] --> I[inputBytes 与 scratchBytes]
  T --> O[outputBytes 预留]
  I --> P[Worker 真正停下 / 准备函数退栈]
  P --> R1[退还 input 与 scratch]
  O --> L[移交 ResultLease]
  L --> C[消费者调了 release()]
  C --> R2[退还 output 与租约名额]
  S[Session / Scope 缓存资源] --> D[await 异步 disposer 跑完]
  D --> ACK[收到 Worker 的确认消息 ACK]
  ACK --> R3[退还缓存容量或线程槽位]
```

## 看懂诊断面板里的两组“容易混淆的数字”

当你在排查内存问题时，经常会在 `stats` 和 `diagnostics()` 里看到下面两组数字，搞清它们的区别非常关键：

### 1. “缓存预留上限（`cacheReservedBytes`）” vs “当前实际用了多少（`cacheUsedBytes`）”

假设你给某个 Pool 配了每线程缓存上限 `cacheBytes: 16 MiB`：
- 当这个池子里的 1 个 Worker 启动时，全局账本就会先把这整整 **`16 MiB`** 的地盘圈出来划给这个 Worker（此时 `reserved.cacheBytes` 就是 `16 MiB`）；
- 当你在 Worker 里往 `ctx.cache` 塞了 `2 MiB` 数据时，它的实际使用量 `cacheUsedBytes` 变成了 `2 MiB`；随后你调 `ctx.cache.delete(key)` 把这条数据删了，`cacheUsedBytes` 变回 `0`——但请注意，**这只是把这个 Worker 自己的抽屉清空了，它从全局账本圈走的那 `16 MiB` 地盘并没有退回给全局！**
- 什么时候才会退回全局的 `cacheBytes`？只有当你调了 `resizePool`、`setMemoryPressure`、`trim` 缩小了每个 Worker 的缓存上限（且收到了 Worker 的 `cache-controlled` 确认），或者这个物理 Worker 线程被销毁退出时，全局额度才会退回来。

### 2. “账本管着的内存” vs “算法自己偷偷建的内存”

- **账本能直接卡住的**：发给 Worker 的输入（`inputBytes`）、Worker 返回的输出（`outputBytes`）、通过 `ctx.scratch.allocate()` 申请的临时空间，以及存在 `ctx.cache` 里的缓存。这些只要超标 1 个字节就会被立刻拦下。
- **需要你主动配合申报的**：你在算法函数里直接写的 `new Float64Array(1000000)`、`JSON.parse()`，或者 WASM 模块自己向浏览器申请的线性内存。请把这些内存的峰值估算进任务的 `scratchBytes` 或常驻租约 `residentBytes` 里，让账本知道你的真实胃口。

## 当清理出错时，为什么“宁可扣着不放，也绝不假装释放”？

在分布式或多线程系统中，最怕的就是“清理失败了，却把名额释放给了下一个人”。因此 `tasklane` 做了两处保守的防线设计：

1. **资源关闭函数（`disposer`）报错时：保留条目供重试**
   你在 `Session` 里用 `ctx.cache.setResource('db', db, 16 * MiB, async (d) => await d.close())` 登记了一个数据库。如果销毁时 `db.close()` 因为磁盘锁死抛了错，`tasklane` **不会**把 `'db'` 从缓存里抹掉，也不会退还那 `16 MiB` 额度，而是把错误原样抛给你的 `delete()` 或 `dispose()` 调用。这样等你解除了外部锁死后，再调一次 `delete('db')` 或 `dispose()` 就能继续把它真正关掉。
2. **物理线程杀不死（`terminate()` 失败）时：关进隔离区（Quarantine）**
   在自定义端点或极端平台故障下，如果调用底层的 `endpoint.terminate()` 报错拒绝了（说明那个旧线程可能还活着、还在占着内存），`Runtime` 会把这个槽位放进隔离区（体现在 `stats.quarantinedWorkers`），**继续扣着它占用的 1 个全局 Worker 名额和缓存额度**。等外部环境恢复后，你只需调用 `await runtime.retryTermination()`，一旦确认它真的死了，名额立刻奉还。

## 源码与契约

- [src/resources/budget.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/budget.ts)
- [src/resources/cache.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/cache.ts)
- [src/resources/lease.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/lease.ts)
- [src/resources/resident.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/resident.ts)
