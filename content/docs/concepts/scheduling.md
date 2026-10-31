---
title: "任务调度"
linkTitle: "任务调度"
description: "理解 tasklane 如何通过三级优先级、分组轮流公平调度以及大任务预算保护，让交互任务不卡顿、大任务不饿死。"
weight: 20
doc_type: explanation
---

在真实应用中，后台任务很少是匀速、单一的。往往是后台正在静默预取 200 个视野外的瓦片，用户突然拖动了地图急需加载当前视口的 4 个瓦片；又或者，“建筑物图层”一口气塞进了 500 个任务，紧接着“道路图层”塞进了 5 个任务。

如果把所有任务都丢进一个简单的“先来后到（FIFO）”队列，用户拖动地图后就得等前 200 个后台任务跑完才能看到画面。

`tasklane` 的调度器通过在**任务真正开始执行前（准入阶段，Admission）**进行智能选路，解决了“谁先跑、怎么公平跑、大任务怎么不饿死”三个问题。

## 1. 三级优先级：让紧急任务优先插队

提交任务时，你可以根据业务紧急程度设置三种 `priority`（不填时默认为 `'foreground'`）：

| 优先级 | 适合什么任务 | 默认排队规则（`strict` 严格模式） |
| --- | --- | --- |
| **`'interactive'`** | 当前屏幕视口渲染、鼠标点击/悬停即时查询 | **最高优先级**。只要有空闲 Worker 和内存额度，永远排在最前面先执行 |
| **`'foreground'`** | 用户主动点击触发的导入、导出、统计分析 | **中等优先级**。当没有可执行的 `interactive` 任务时立即执行 |
| **`'background'`** | 视野外数据预取、后台缓存预热、离线索引构建 | **最低优先级**。只在系统有空闲余量且前面没有高优任务时才执行 |

> **注意：不打断正在跑的任务**
> 优先级决定的是**等待队列里谁下一个进 Worker**，已经发进 Worker 正在运行的任务不会被中途打断（除非你主动调用取消）。因此，如果后台任务总能把所有 Worker 占满，你还可以配合 `interactiveReserve` 为交互任务专门留出不许后台任务占用的独立线程槽位（详见[资源调度与内存压力](/docs/guides/resource-scheduling/)）。

### 严格模式（`strict`）vs 老化提升（`ageing`）

- **`priorityPolicy: 'strict'`（默认）**：只要有可执行的 `interactive` 任务，`background` 任务就一直让路。适合绝大多数以前端交互体验为最高准则的应用。
- **`priorityPolicy: 'ageing'`（可选）**：如果你担心高优任务源源不断导致后台任务永远跑不上，可以开启 `'ageing'`。开启后，排队任务每多等一个 `ageingMs`（默认 `2000` ms），它的有效排队优先级就会自动升一级（`background ➔ foreground ➔ interactive`），确保长期等待的任务最终一定能被执行。

## 2. 分组公平调度（`group`）：防止单个大户霸占线程池

假设两个图层都是 `'foreground'` 优先级：“建筑物图层”先提交了 500 个分块任务，0.1 秒后“道路图层”提交了 5 个分块任务。如果同优先级内只按先来后到排队，道路图层就必须等 500 个建筑物分块全算完才能显示。

只要你在提交任务时带上 `group` 标签（比如 `group: 'buildings'` 和 `group: 'roads'`），调度器就会自动开启**组间轮流公平服务**：

- **同组内保持先后顺序（FIFO）**：属于 `'buildings'` 内部的任务依然按提交顺序依次执行；
- **不同组之间轮流交替**：当一个 Worker 跑完一个 `'buildings'` 任务空出来时，调度器看到 `'roads'` 组更久没有被服务过，就会优先挑出 `'roads'` 组的第 1 个任务执行。这样两个图层就能齐头并进地渲染出来。

同时，不同 Worker 池（比如 `compute` 池和 `raster` 池）或不同独占 `Session` 的队列是彼此独立的：`raster` 池满了，绝不会挡住 `compute` 池的任务。

## 3. 大任务的预算防饥饿保护：防止被小任务无限插队

再考虑一种和内存预算有关的情况：
假设当前全局只剩 `12 MiB` 的输入内存额度。此时队头排着一个需要 `16 MiB` 额度的大任务，而它身后源源不断涌入只需要 `2 MiB` 的同优先级小任务。

如果不加保护，每当有 `2 MiB` 额度释放出来，后面的小任务因为“刚好够用”就会立刻插队把额度抢走，导致那个需要 `16 MiB` 的大任务永远攒不够额度，一直干等到超时。

为了解决这个问题，`tasklane` 内置了**大任务防饥饿保护（Starvation Protection）**：

1. 当一个大任务已经排到了空闲的物理 Worker 槽位，仅仅因为某项字节预算不够而等待超过了 `budgetWaitMs`（默认 `1000` ms）时，账本会为它贴上“攒额度保护”标签；
2. 保护一旦生效，**同优先级或更低优先级**的小任务就不允许再消耗这项短缺的预算，系统会把陆续释放出来的内存额度存起来，直到凑够 `16 MiB` 让这个大任务顺利启动；
3. 如果你配置了专门的 `interactiveReserve` 交互预留额度，非交互大任务的攒额度保护不会挡住拥有独立预留额度的 `'interactive'` 紧急任务。

## 源码与契约

- [src/runtime/scheduler.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/scheduler.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [docs/resources.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resources.md)
