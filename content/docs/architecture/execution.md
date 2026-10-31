---
title: "任务执行时序"
linkTitle: "任务执行时序"
description: "跟着一条任务从入队、领额度、准备数据、发往 Worker 计算到最终释放结果租约，看清每一步的状态与内存变化。"
weight: 10
doc_type: explanation
---

当你调用 `scope.enqueue()` 提交一个任务时，它在内部究竟经历了哪些步骤？每一笔内存额度是在哪一毫秒扣下、又是在哪一毫秒退回来的？

下面的时序图完整展示了一条标准任务从出生到彻底结束的一生：

{{< diagram name="execution" alt="从任务入队到结果释放的执行阶段" >}}

## 为什么把 `enqueue` 和 `enqueuePrepared` 的准入拆成两条路？

细看上面的第 2～4 步，你会发现同步准备（`enqueue`）和异步准备（`enqueuePrepared`）在**“什么时候领 Worker”**上走的是两条不同的路：

1. **普通 `enqueue`（先领 Worker，再同步 `prepare`）**：
   因为 `prepare()` 只在内存里切个片或包个对象（几微秒就跑完了），所以任务在 `queued` 队列里等到**空闲 Worker 和内存额度都齐了**之后，直接锁住那个 Worker、跑一下 `prepare()` 就把数据发过去了。
2. **异步 `enqueuePrepared`（先领准备名额做异步读取，读完了再领 Worker）**：
   因为 `prepareAsync()` 要去等慢速的磁盘文件或网络读取（可能要几十毫秒），如果一开始就把 Worker 锁住，那个 Worker 就得陪着干等。所以它分两步走：
   - **第一步（准备准入）**：先检查 `maxPreparingTasks` 窗口（默认最多 `2` 个）和内存预算够不够；够了就扣下预算开始跑 `prepareAsync`（状态变为 `preparing`），**此时还不占任何 Worker 线程**；
   - **第二步（执行准入）**：等 `prepareAsync` 读完数据返回后，状态变为 `prepared`，这时再去领空闲的 Worker 把数据发出去（状态变为 `running`）。

## 任务一生中的 9 种公开状态（`handle.state`）

你随时可以读取 `handle.state` 查看任务当前走到了哪一步：

| `handle.state` 值 | 它现在正在干什么 |
| --- | --- |
| `'queued'` | 刚提交进来，正在队列里等空闲 Worker 或等内存额度 |
| `'starting'` | 已经分到了一个新 Worker 槽位，正在等 Worker 加载脚本并完成 `hello / ready` 握手 |
| `'preparing'` | 正在主线程里执行你写的 `prepare()` 或 `prepareAsync()` |
| `'prepared'` | `prepareAsync()` 已经把异步数据读好了，正在等一个空闲 Worker 把它发出去 |
| `'running'` | 数据已经发进 Worker，正在跑你的计算函数 |
| `'cancelling'` | 收到了你的取消指令，正在等 `prepareAsync` 退栈或等 Worker 停下脚步 |
| `'succeeded'` | Worker 已成功算完返回，`ResultLease` 已经交到你手上 |
| `'failed'` | 因为参数不对、预算超标、超时、Worker 崩溃或计算函数抛错而失败 |
| `'cancelled'` | 已经成功取消并把占用的资源收拾干净了 |

## 如果中途点了取消，内存额度什么时候退？

这是运行时设计里最讲究的一点：**绝不在物理动作还没停下前提前退还额度**。

- **如果在 `queued` 或 `prepared`（还没发给 Worker）时取消**：因为还没动用 Worker，当场移除并退还所有预留额度；
- **如果在 `preparing`（正在跑异步读取）时取消**：`handle.result` 会立刻报错让你不用干等，但扣下的内存额度和准备窗口名额，会一直等到你的 `prepareAsync` 函数真正退栈后才退还（而且退栈后返回的迟到数据绝不会再发给 Worker）；
- **如果在 `running`（Worker 正在算）时取消**：在协作取消（`'cooperative'`）或丢弃结果（`'discard'`）模式下，那个 Worker 槽位和 `inputBytes` / `scratchBytes` 额度会一直锁到 Worker 真正发回终态消息为止——这样就能百分之百保证：**绝不会在一个 Worker 还没把上一个被取消的任务停稳之前，就把下一个新任务塞给它。**

## 源码与契约

- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [src/resources/lease.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/lease.ts)
- [src/host.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/host.ts)
