---
title: "资源调度与内存压力"
linkTitle: "资源调度与内存压力"
description: "为交互任务预留专属通道（interactiveReserve）、用 SessionGroup 多副本智能选路，以及在内存吃紧时动态缩容。"
weight: 50
doc_type: how-to
---

当你的应用进入深水区（比如同时加载十几个大图层、在低内存移动设备上运行，或者用多个 Worker 并行读取同一个超大遥感文件）时，你可以通过下面四项高级调度能力来精细掌控资源。

## 1. 给交互任务留出“应急车道”（`interactiveReserve`）

前面我们知道，把任务设为 `priority: 'interactive'` 可以让它在排队时插到最前面。但假如后台任务已经把 4 个 Worker 线程（或者全部 `64 MiB` 输出额度）占得满满当当，正在跑的任务又不能中途打断，后来的 `interactive` 任务还是得在门口干等。

如果你想确保**无论后台有多忙，永远至少留着 1 个空闲 Worker 和 `16 MiB` 内存专门等用户的交互操作**，可以在创建 `Runtime` 时配置 `interactiveReserve`：

```ts
const MiB = 1024 ** 2;

const runtime = createWorkerRuntime({
  pools: {
    raster: {
      factory: browserWorker(new URL('./raster.worker.js', import.meta.url)),
      size: 4,
      cacheBytes: 16 * MiB,
      interactiveWorkers: 1, // 在这个池子里，至少留 1 个 Worker 只准 interactive 任务用
    },
  },
  maxWorkers: 4,
  maxActiveTasks: 4,
  maxPreparingTasks: 2,
  maxResultLeases: 16,
  budgets: {
    inputBytes: 64 * MiB,
    scratchBytes: 64 * MiB,
    outputBytes: 64 * MiB,
    cacheBytes: 64 * MiB,
    residentBytes: 64 * MiB,
  },
  // 全局预留给 interactive 任务的专属保底配额：
  interactiveReserve: {
    workers: 1,
    activeTasks: 1,
    preparingTasks: 1,
    resultLeases: 2,
    budgets: {
      outputBytes: 16 * MiB,
      residentBytes: 16 * MiB,
    },
  },
});
```

配置之后：
- 普通任务（`foreground` 和 `background`）最多只能用到 `4 - 1 = 3` 个 Worker 和 `64 - 16 = 48 MiB` 的输出额度；
- 最后那 1 个 Worker 和 `16 MiB` 额度就像高速公路的“应急车道”，只有标了 `priority: 'interactive'` 的任务或会话才能开进去！

## 2. 用 `SessionGroup` 让多个副本协同加速

当只用 1 个 `Session` 读取大文件不够快时，你可以开多个指向同一文件的 `Session`（比如 1 个主会话 + 1 个允许空闲回收的备用副本 `reclaimable: true`），然后用 `scope.sessionGroup` 把它们绑成一个组。

### Worker 端：汇报自己肚子里缓存了哪些数据块

```ts
const lease = ctx.cache.setResource(
  'cog-reader',
  reader,
  16 * MiB,
  (r) => r.close(),
  {
    // 当系统内存吃紧要求缩容时，会自动调这个 trim 回调让你清理内部缓存
    trim: async (targetBytes) => {
      await reader.evictBlocksUntil(targetBytes);
      lease.report(reader.getCacheSnapshot());
      return reader.currentReservedBytes; // 返回清理后实际还需要保留的字节数
    },
  },
);

// 每次读完数据块后，顺手汇报当前已经缓存了哪些块的 key（完整替换快照）
lease.report({
  hits: reader.hits,
  misses: reader.misses,
  evictions: reader.evictions,
  usedBytes: reader.usedBytes,
  keys: ['tiff-source-1/z4/block-8', 'tiff-source-1/z4/block-9'],
});
```

### 主线程端：把任务交给 `SessionGroup` 自动挑最合适的副本

```ts
const primary = await scope.acquireSession('raster', { priority: 'foreground' });
const replica = await scope.acquireSession('raster', {
  priority: 'foreground',
  reclaimable: true, // 标为可回收：系统忙或内存紧时可以自动关掉这个备用副本
  reclaimPriority: 10,
});

// 先让两个 Session 都打开同一个数据源
await Promise.all([openSource(primary), openSource(replica)]);

// 组成 SessionGroup（注意：组内所有成员必须属于同一个 Scope、Pool 且准入 priority 相同）
const group = scope.sessionGroup([primary, replica]);

// 提交任务并带上需要的块 key：组会自动挑当前空闲、且已缓存最多对应 key 的副本去执行！
const handle = group.enqueue('decodeTile', {
  budget: { inputBytes: 4096, scratchBytes: 2 * MiB, outputBytes: 2 * MiB },
  affinity: { keys: ['tiff-source-1/z4/block-8', 'tiff-source-1/z4/block-10'] },
  prepare: () => ({ payload: tileRequest }),
});
```

## 3. 在内存吃紧或切到后台时主动缩容

当你的页面被切到后台标签页，或者监测到设备内存紧张时，你可以随时调用以下三个维护方法来释放内存（它们都在创建时设定的硬上限内调节，且不会强行打断正在跑的任务）：

```ts
// 方式 A：手动调小某个池子的目标线程数与每线程缓存上限
const resizeReport = await runtime.resizePool('raster', {
  size: 2,
  cacheBytes: 8 * MiB,
});

// 方式 B：一键切换全局内存压力档位（'normal' | 'moderate' | 'critical'）
// - 'moderate'：所有池子的目标线程数和缓存上限直接减半
// - 'critical'：压到最低（非预留缓存降为 0，并立即回收所有空闲 Worker 和可回收 Session）
// - 'normal'：恢复到进入压力前的正常目标配置
await runtime.setMemoryPressure('moderate');

// 方式 C：立即执行一次大扫除（清空指定缓存、回收空闲线程与可回收副本）
const trimReport = await runtime.trim({
  pool: 'raster',
  cacheBytesPerWorker: 0,
  workersPerPool: 1,
  reclaimSessions: true,
});
```

## 4. 开启池子自动伸缩（`adaptive`）

如果你不想手动调 `resizePool`，也可以在配置 Pool 时加上 `adaptive`，让池子根据“队列有没有积压”和“缓存未命中率高不高”自动在最小值和最大值之间伸缩：

```ts
pools: {
  compute: {
    factory: browserWorker(new URL('./compute.worker.js', import.meta.url)),
    size: 6,            // 硬上限最多 6 个线程
    cacheBytes: 32 * MiB, // 硬上限每线程最多 32 MiB 缓存
    adaptive: {
      minWorkers: 1,        // 平时空闲只保留 1 个线程的目标配额
      minCacheBytes: 4 * MiB,
      sampleMs: 1000,       // 每隔 1 秒看一次队列：如果一直在排队，就每次 +1 线程目标
      idleMs: 30_000,       // 连续空闲满 30 秒后，自动缩回 minWorkers 和 minCacheBytes
      missRatio: 0.2,       // 如果缓存经常不够用且未命中率 >= 20%，自动把缓存目标调大 50%
    },
  },
}
```

> **什么时候别开 `adaptive`？**
> 开启 `adaptive` 后，池子默认从 `minWorkers`（比如 1 个）起步，遇到排队每秒才往上加 1 个。如果你的业务要求“第一秒突然来 6 个任务时，必须立刻同时拉起 6 个线程全力跑”，那就不必开 `adaptive`（因为普通池子本身也是没任务不建线程、空闲满 `idleTimeoutMs` 自动销毁的），或者直接把 `minWorkers` 设大。

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [docs/resource-scheduling.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resource-scheduling.md)
