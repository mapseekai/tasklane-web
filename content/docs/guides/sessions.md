---
title: "状态型计算"
linkTitle: "状态型计算"
description: "在 Worker 中长驻 SQLite / DuckDB 数据库、GDAL 或 WASM 实例，使用 Session 固定线程并在关闭时安全释放。"
weight: 40
doc_type: how-to
---

当你在 Worker 里初始化了一个 WASM 模块、打开了一个 SQLite / DuckDB 数据库连接，或者加载了一个 GDAL 数据集句柄时，你会面临两个核心要求：
1. **后续的查询任务必须发回同一个 Worker**（因为数据库连接不能跨线程搬运）；
2. **用完关闭时，必须先调 `await db.close()` 把底层句柄关掉，才能释放内存额度。**

本篇指南一步步展示如何用 **`Session`（独占会话）** 配合 **`ctx.cache.setResource`** 实现安全的状态型计算。

## 第 1 步：给 Worker 池配置充足的 `cacheBytes`

凡是存在 Worker 本地缓存（`ctx.cache`）里的东西，都要消耗该 Worker 的缓存额度。因此在创建 `Runtime` 时，请先为有状态的 Pool 分配足够的 `cacheBytes`：

```ts
const MiB = 1024 ** 2;

const runtime = createWorkerRuntime({
  pools: {
    database: {
      factory: browserWorker(new URL('./db.worker.js', import.meta.url)),
      size: 2,
      cacheBytes: 32 * MiB, // 允许每个 database Worker 最多存放 32 MiB 的缓存或资源实例
    },
  },
  budgets: {
    cacheBytes: 64 * MiB, // 全局缓存总额度需能装下池子里的 Worker
  },
});
```

## 第 2 步：在 Worker 里用 `setResource` 登记实例与关闭函数

对于数据库连接或 WASM 实例，`tasklane` 没法自己算出它占了多少内存，也不知道该怎么关闭它。因此，在 Worker 里请使用 `ctx.cache.setResource(key, instance, estimatedBytes, disposer)` 把它登记进去：

```ts
import { browserHost, output, serve } from '@mapseekai/tasklane/host';

const MiB = 1024 ** 2;

serve(browserHost(self), {
  // 1. 初始化并登记数据库实例
  async open({ dbName }: { dbName: string }, ctx) {
    // 如果之前已经开过同名实例，必须先 await delete 等旧实例彻底关干净！
    await ctx.cache.delete('db');

    const db = await openEmbeddedDatabase(dbName);

    // 登记实例：申报预估占用 16 MiB，并提供异步关闭函数 disposer
    ctx.cache.setResource('db', db, 16 * MiB, async (instance) => {
      await instance.close();
    });

    return output({ ready: true });
  },

  // 2. 后续查询直接从当前 Session 的缓存里取出同一个 db 实例
  async query({ sql }: { sql: string }, ctx) {
    const db = ctx.cache.get<EmbeddedDatabase>('db');
    if (!db) {
      throw new Error('当前 Session 尚未初始化数据库');
    }
    const rows = await db.execute(sql);
    return output(rows);
  },
});
```

这样登记之后，不管是你在代码里调了 `await ctx.cache.delete('db')`，还是外面的主线程调了 `await session.dispose()` 或 `await scope.dispose()`，**`tasklane` 都会自动调用你传入的 `async (instance) => await instance.close()`，并一直等到它执行成功后再确认释放**！

## 第 3 步：在主线程申请 `Session` 并连续发送任务

在主线程中，推荐用 `await scope.acquireSession('database')` 提前领走一个专属 Worker，然后依次发送 `open` 和 `query` 任务：

```ts
// 申请并绑定一个专属 Worker（若池子满了默认会排队等待；想立刻报错可传 mode: 'immediate'）
const session = await scope.acquireSession('database', {
  mode: 'wait',
  priority: 'foreground',
});

try {
  // 第 1 个任务：打开数据库
  await consumeResult(
    session.enqueue('open', {
      budget: { inputBytes: 1024, scratchBytes: 0, outputBytes: 256 },
      prepare: () => ({ payload: { dbName: 'roads.sqlite' } }),
    }),
    () => {},
  );

  // 第 2 个任务：保证发往刚才同一个 Worker，直接复用已打开的数据库！
  await consumeResult(
    session.enqueue('query', {
      budget: { inputBytes: 1024, scratchBytes: 4 * MiB, outputBytes: 2 * MiB },
      prepare: () => ({ payload: { sql: 'SELECT * FROM roads LIMIT 100' } }),
    }),
    (rows) => renderTable(rows),
  );
} finally {
  // 用完后关闭会话：自动触发 Worker 里注册的 db.close()，并把 Worker 还给池子
  await session.dispose();
}
```

## 实用技巧：如果在 Worker 里缓存百万级大数组，请用 `setBinary`

除了数据库实例，如果你还想在 Worker 缓存里存一个包含几百万个数字的 `Float32Array`（比如高程网格或查找表）：

- **别直接调普通 `ctx.cache.set('grid', float32Array)`**：因为普通 `set()` 为了防范用户在数组对象上乱挂自定义属性，会去遍历检查对象的属性键，在几百万元素的 `TypedArray` 上会白白浪费 CPU 时间。
- **改用 `ctx.cache.setBinary('grid', float32Array)`**：它是专门为二进制视图设计的快速通道——**不遍历下标、不拷贝内存**，直接保存干净的原生视图并按底层 `ArrayBuffer` 大小计费（注意：缓存在用期间，千万别把这个数组的底层 `buffer` 放进 `transfer` 列表转走）。

## 两个必须留意的工程边界

1. **别让长驻 `Session` 把全局线程占光**：
   因为一个绑定了的 `Session` 会一直霸占 1 个 Worker 直到关闭，如果你的 `Runtime` 总共只配了 `maxWorkers: 4`，而你一口气开了 4 个长期不关的 `Session`，那普通短任务就一个线程都分不到了。规划容量时，请让有状态 Pool 的 `size` 小于全局 `maxWorkers`，给普通计算池留出余地。
2. **妥善处理 `SESSION_LOST`（线程崩溃重建）**：
   万一那个专属 Worker 因为内存溢出或执行超时被系统杀掉了，`session.state` 会变成 `'lost'`，发给它的任务会报错 `code === 'SESSION_LOST'`。这时里面的数据库连接已经没了，请捕获这个错误，调 `await session.dispose()`，然后新建一个 `Session` 重新跑一次 `open`。

## 源码与契约

- [src/resources/cache.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/cache.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [docs/emap-upgrade.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/emap-upgrade.md)
