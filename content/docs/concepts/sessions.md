---
title: "Affinity 与 Session"
linkTitle: "Affinity 与 Session"
description: "当 Worker 内部需要保留缓存或状态时，如何根据“状态丢了能不能重算”在 affinity、Session 与 SessionGroup 之间做选择。"
weight: 60
doc_type: explanation
---

当池子里有多个 Worker 线程时，默认情况下，任何一个空闲的 Worker 都可以接取下一个任务。这对纯计算函数（比如给一组坐标做投影转换）来说没有任何问题。

但在实际业务中，Worker 往往会在本地留存一些东西：
- **情况 A（丢了能重算）**：Worker 刚才解压了一张字体表或一块瓦片网格，顺手存在了本地缓存（`ctx.cache`）里。下次如果还是处理同一个区域的任务，最好还分给这个 Worker，这样能直接命中缓存；但如果这个 Worker 正忙，分给别的 Worker 重新解压一次也能接受。
- **情况 B（丢了不能跑）**：你刚才让 Worker 1 打开了一个本地文件游标、初始化了一个 WASM 实例，或者连上了一个内存 SQLite 数据库。接下来的“读取下一块”或“执行 SQL 查询”任务，**必须百分之百发给刚才那个 Worker 1**——要是发给了毫不知情的 Worker 2，任务当场就会报错失败。

针对这两种截然不同的需求，以及高并发只读副本场景，`tasklane` 提供了三种状态路由机制。

## 一句话选对机制：看状态“能不能丢”

| 机制 | 它的行为保证 | 会不会独占 Worker？ | 典型适用场景 |
| --- | --- | --- | --- |
| **`affinity`（软亲和性）** | **尽量派给熟手**：如果上次成功跑过这个 key 的 Worker 正好空闲，就优先派给它；如果它正忙，立刻改派给其他空闲 Worker | **不独占**（大家共用池子） | 可随时重算的解压块缓存、字形缓存、局部索引 |
| **`Session`（独占会话）** | **死死绑定同一个 Worker**：这个会话里的所有任务，永远只发给它绑定的那一个物理 Worker | **独占 1 个 Worker**（直到会话关闭） | 数据库连接（SQLite / DuckDB）、WASM 实例、文件顺序读取游标 |
| **`SessionGroup`（多副本会话组）** | **在多个已打开的副本里挑缓存最全的**：你先开好几个指向同一文件的 `Session`，组会自动把任务派给已缓存对应数据块的空闲副本 | 借用你传入的 `Session` 成员 | 高并发只读大文件（如同时用 2～3 个 Worker 并行读取同一个超大 COG 栅格文件） |

## 1. 软亲和性（`affinity`）：不占坑位的缓存加速

在普通任务里加上 `affinity: 'dataset-a/tile-12'`（或者传多个键 `affinity: { keys: ['block-1', 'block-2'] }`），本质上是给调度器递了一张小纸条：

> “上次是谁成功算过 `dataset-a/tile-12` 的？如果它现在闲着，优先把这个任务给它；如果它在忙别的，那就别等了，随便找个闲着的 Worker 算就行。”

因此，**千万不要把必须保留的状态寄托在 `affinity` 上**。使用 `affinity` 时，你的 Worker 代码写法永远是：“先查一下 `ctx.cache.get(key)` 在不在；在就直接用，不在就现场算一份再 `ctx.cache.set(key, val)` 存进去。”

## 2. 独占会话（`Session`）：一人一间专属办公室

当你调用 `scope.session(pool)`（首次发任务时绑定）或 `await scope.acquireSession(pool)`（立即分配并启动 Worker）时，你就从池子里领走了一个专属的物理 Worker：

- 在你调用 `await session.dispose()` 关闭会话之前，这个 Worker 不会再接池子里的任何其他任务，也不会因为空闲超时（`idleTimeoutMs`）而被回收；
- 你在 Worker 内部通过 `ctx.cache.setResource(key, db, bytes, disposer)` 注册的数据库连接或 WASM 实例，会稳稳地驻留在这个 Worker 里；
- **如果这个 Worker 意外崩溃了怎么办？** 一旦底层线程崩溃或因为任务执行超时被强杀，这个 `Session` 的状态就会变成 `'lost'`，后续所有发往它的任务都会明确报错 `SESSION_LOST`。因为里面的内存状态已经随线程一起消失了，`tasklane` 不会自作主张替你偷偷换一个空 Worker 假装无事发生，而是明确通知你的业务层：“会话丢了，请新建一个 `Session` 并重新执行 `open` 初始化。”

### 备用会话可以标为“可回收”（`reclaimable: true`）

默认情况下，`Session` 是受保护的必需资源，就算内存吃紧也不会被系统强拆。但如果你为了加快读取速度多开了几个备用只读 `Session`，可以在创建时加上 `{ reclaimable: true }`。这样当系统缩容或内存压力变大时，只要这个备用 `Session` 当前没在跑任务、也没锁着未消费的结果，系统就可以安全地关闭它（自动触发你注册的 `disposer`）来腾出线程和内存。

## 3. 多副本会话组（`SessionGroup`）：既要绑定句柄，又要多核并行

假设你有一个 2 GiB 的 Cloud Optimized GeoTIFF (COG) 遥感影像文件：
- 如果只开 1 个 `Session`，同一时刻只能有 1 个线程解码瓦片，多核 CPU 用不上；
- 如果开 3 个独立的 `Session`（1 个主会话 + 2 个 `reclaimable: true` 的副本会话）都打开这同一个文件，然后用 `const group = scope.sessionGroup([s1, s2, s3])` 把它们编成一个组：
  - 每个 Worker 里的读取器通过 `resource.report({ keys: [...] })` 汇报自己当前内存里已经缓存了哪些数据块；
  - 当你向 `group.enqueue` 提交任务并带上 `affinity: { keys: ['block-8'] }` 时，`SessionGroup` 会在当前空闲的副本里，优先挑出**肚子里已经有 `'block-8'` 缓存**的那个副本去执行！这样既实现了多核并行读取，又最大程度复用了各个副本内部的块缓存。具体代码写法见[状态型计算](/docs/guides/sessions/)与[资源调度与内存压力](/docs/guides/resource-scheduling/)。

## 源码与契约

- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [docs/resource-scheduling.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resource-scheduling.md)
