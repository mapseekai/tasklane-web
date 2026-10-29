---
title: "状态型计算"
linkTitle: "状态型计算"
description: "使用独占 Session 管理数据库、WASM 和不透明资源。"
weight: 40
doc_type: how-to
---

创建 Session 后，通过会话任务初始化 Worker 内的状态。初始化与后续请求使用同一个 Session，资源保存到其缓存命名空间。

```ts
const session = await scope.acquireSession('database', {
  mode: 'wait',
  residentBytes: 32 * MiB,
});
try {
  await consumeResult(session.enqueue('open', openOptions), consumeOpened);
  await consumeResult(session.enqueue('query', queryOptions), consumeRows);
} finally {
  await session.dispose();
}
```

`openOptions`、`queryOptions` 和消费者由应用定义。需要立即反馈容量不足时使用 `mode: 'immediate'`，并检查 `SessionAdmissionError.reasons`。

前提是目标 Pool 已配置足够的每 Worker `cacheBytes`，并且 Runtime 的全局缓存额度能容纳这些 Worker。`residentBytes` 不会自动增加 Worker cache 容量。

## 注册不透明资源

Worker 内通过 `ctx.cache.setResource(key, value, bytes, disposer)` 注册实例。普通数据使用 `set` 或 `setPinned`，数据库句柄等不透明对象需要 disposer。

```ts
ctx.cache.setResource('db', database, estimatedBytes, async (db) => {
  await db.close();
});
await ctx.cache.delete('db');
```

`estimatedBytes` 由业务提供上界。不透明资源信任这个声明；容量增长也必须由业务约束。替换实例前先 `await delete`，等待旧资源销毁完成。

## 规划容量

已绑定 Session 独占 Worker。应用需给短任务保留足够槽位，并纳入 resident 与 cache 的不同归属。Worker 中的 `setResource` 使用 Worker cache 额度；调用线程的 `resources.acquire` 使用 resident 额度，避免把同一实际资源不加区分地重复记账。

清理失败时，资源和容量继续保留以便重试。会话进入 `lost` 后，由应用重建底层状态。

## 源码与契约

- [src/resources/cache.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/cache.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [docs/emap-upgrade.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/emap-upgrade.md)
