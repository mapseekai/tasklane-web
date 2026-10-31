---
title: "资源预算"
linkTitle: "资源预算"
description: "看懂 inputBytes、scratchBytes、outputBytes、cacheBytes 与 residentBytes 五类内存预算，理解如何用预算账本守住内存上限。"
weight: 30
doc_type: explanation
---

在浏览器或 Node.js 中处理大数据时，很多人以为“只要把 Worker 线程数限制为 2 个，内存就安全了”。

但实际上，就算只有 2 个 Worker，内存依然经常在另外三个地方崩溃：
1. **入队前撑爆**：主线程一口气创建了 100 个各占 16 MiB 的输入数组塞进等待队列；
2. **计算中撑爆**：2 个 Worker 同时在内部开辟了上百 MiB 的临时缓冲；
3. **消费前撑爆**：Worker 算得飞快，已经算完返回了 80 个大结果，而主线程还没来得及消费释放。

为了把这整条链路管起来，`tasklane` 设立了集中式的**五类内存预算账本（`BudgetLedger`）**。

## 五类预算分别管哪一段内存？

你可以把一次后台任务想象成工厂流水线上的加工单，五类预算分别对应流水线上五个环节的仓库容量：

| 预算名称 | 默认全局上限 | 它管的是哪部分数据？ | 什么时候扣额度？ | 什么时候还额度？ |
| --- | ---: | --- | --- | --- |
| **`inputBytes`** | `64 MiB` | **主线程发给 Worker 的输入数据** | 任务获准开始准备/执行时 | Worker 算完返回（或准备阶段被取消退出）时**立即归还** |
| **`scratchBytes`** | `128 MiB` | **Worker 计算过程中申请的临时工作空间** | 任务获准开始准备/执行时 | Worker 算完返回时自动清空临时空间并**立即归还** |
| **`outputBytes`** | `64 MiB` | **Worker 算出来的返回结果** | 任务获准开始准备/执行时 | 等主线程消费者**读完结果并释放租约（`ResultLease`）后**才归还 |
| **`cacheBytes`** | `128 MiB` | **Worker 本地缓存（`ctx.cache`）的容量上限** | Worker 线程启动或扩容时 | Worker 确认缩容完成或线程销毁退出后归还 |
| **`residentBytes`** | `128 MiB` | **跨任务长期持有的常驻内存租约（`ResourceLease`）** | 显式调用 `resources.acquire` 或 `acquireSession` 时 | 调小租约、释放租约或所属 `Scope` 销毁后归还 |

每当一个任务排到队头准备启动时，`Runtime` 会先看一眼账本：**剩余的 `inputBytes`、`scratchBytes` 和 `outputBytes` 够不够这个任务申报的 `budget`？**
- 只有三项全够，才会一次性扣下这三笔额度，并调用你的 `prepare()` 函数生成输入数据发给 Worker；
- 如果不够，任务就老老实实留在队列里（此时 `prepare()` 还没调用，不会提前分配大数组！），等前面的任务归还额度后再启动；
- 如果单个任务申报的 `budget` 直接超过了全局总上限，入队时会当场报错 `BUDGET_EXCEEDED`，绝不会让你在队列里无限死等。

## 输入和输出是怎么算字节数的？（协议计费规则）

在把数据发进通道前，`tasklane` 会自动核算这份数据的协议字节大小，检查它有没有超出你申报的 `budget.inputBytes` 或 `budget.outputBytes`（也就是“有没有少报谎报”）：

1. **直接传 `TypedArray` 或 `ArrayBuffer`（最省心）**：
   如果你直接传一个 `new Float64Array(1000)`，它的计费大小就是它底层 `ArrayBuffer` 的字节长度（`8000` 字节），没有任何额外费用。
2. **传普通对象或数组（需留出一点元数据余量）**：
   如果你传的是复合对象 `{ type: 'road', coords: new Float64Array(1000) }`，除了 `coords` 的 `8000` 字节外，`tasklane` 还会把对象属性名、字符串等元数据的编码字节数算进去。因此，传复合对象时，建议在二进制大小基础上多留几千字节的余量（比如 `budget: { inputBytes: 8000 + 4096, ... }`）。
3. **传 `File` 或 `Blob` 文件对象（单独用 `blobLimits` 控制）**：
   `File` 和 `Blob` 传递的是底层文件句柄，不会把几百兆的文件内容直接拷进内存包里。所以 `inputBytes` 只收每个文件 `64` 字节的引用费和文件名长度；而**文件本身的字节大小**则由任务上的 `blobLimits: { inputBytes: file.size, outputBytes: 0 }` 单独把关（默认是 `0`，即传非空文件必须显式开启 `blobLimits`，详见[文件与分块](/docs/guides/files/)）。

> **性能提醒：别在每次发送前用 `packetByteLength()` 算大对象**
> `@mapseekai/tasklane` 导出了 `packetByteLength(value)` 工具函数，可以精确算出任意数据的协议计费字节数。但它内部需要把整个对象图完整遍历编码一遍——你可以在写测试或调试时用它核对大小，而在生产代码中，请直接根据你的数据分块规格算出一个安全上限填进 `budget`。

## 预算账本与真实进程内存（RSS）的边界

最后需要明白一点：JavaScript 语言本身没有提供拦截 `new Array()` 或阻止 WASM 内存增长的底层钩子。因此，`tasklane` 的预算账本采用的是**“契约申报 + 边界核查”**模式：

- **传输边界由框架强制核查**：主线程发出的输入、Worker 返回的输出，只要超过申报的 `inputBytes` / `outputBytes` 就会被立刻拦截报错；
- **受控暂存由 `ctx.scratch` 强制核查**：在 Worker 里调用 `ctx.scratch.allocate(bytes)` 申请的临时 `ArrayBuffer`，一旦超过 `scratchBytes` 也会被拦截，且任务结束时自动清空回收；
- **算法内部自建对象由开发者如实申报**：如果你的算法在 Worker 里自己写了 `new Float64Array(...)`、`JSON.parse()` 或调用了 WASM / C++ 插件，请你把这部分算法峰值内存如实估算并填进任务的 `scratchBytes`（或会话的 `cacheBytes` / `residentBytes`）里，让调度器据此帮你控制并发数。

## 源码与契约

- [src/resources/budget.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/budget.ts)
- [src/resources/scratch.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/scratch.ts)
- [src/resources/resident.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/resident.ts)
- [docs/resources.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resources.md)
