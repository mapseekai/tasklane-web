---
title: 常见问题与避坑指南
description: 汇总开发者在实际落地 tasklane 过程中最高频遇到的疑问、常见反模式与对应解决方案。
weight: 9
doc_type: how-to
---

在实际工程落地中，开发者由单线程思维切换至受管的多线程调度思维时，容易踩中数据所有权、内存生命周期和构建环境方面的陷阱。本文整理了最高频的疑难问题与最佳实践对策。

---

## 数据传输与内存管理

### Q1: 为什么转移给 Worker 的 `ArrayBuffer` 在主线程打印变成 0？

**现象**：
```typescript
const buffer = new ArrayBuffer(1024 * 1024);
console.log(buffer.byteLength); // 1048576

const task = scope.enqueue('process', {
  pool: 'compute',
  budget: { inputBytes: 1024 * 1024, scratchBytes: 0, outputBytes: 0 },
  prepare() {
    return {
      payload: buffer,
      transfer: transferBuffers(buffer), // 零拷贝转移所有权
    };
  },
});

console.log(buffer.byteLength); // 0！
```

**原因**：
这是 Web 标准中 Transferable Objects 的核心设计。零拷贝的本质是**内存指针所有权的移交**，而不是复制一份。一旦执行转移，底层内存地址立即挂载到目标线程，主线程的原有引用被彻底剥离（Detached），因此其长度变为 0。

**正确姿势**：
- 如果主线程后续仍然需要使用这份数据，**不要将其放入 `transfer` 数组**，tasklane 会安全使用结构化克隆（Structured Clone）复制一份；
- 如果追求极限性能（如几百兆大文件），请在移交所有权后彻底放弃主线程引用，计算完毕后由 Worker 将结果再次作为 Transferable 移交回主线程。

---

### Q2: 为什么页面运行久了内存一直上涨不下降？

**典型反模式**：
```typescript
// ❌ 错误：无限期滞留租约
const leases = [];
for (const item of items) {
  const task = scope.enqueue('calc', { ... });
  const lease = await task.result;
  leases.push(lease); // 将整个租约对象长期缓存在数组中，未 release
}
```

**原因**：
tasklane 的结果是以**租约（`ResultLease`）**的形式返回的。只要调用方持有着租约对象且未显式调用 `lease.release()`，底层账本为了保证零拷贝访问的有效性，会锁定该内存额度，阻止垃圾回收器（GC）回收该内存片段。

**正确姿势**：
使用 `consumeResult` 工具函数，它会在你的回调函数执行完毕后**自动归还租约与内存额度**：

```typescript
// ✅ 正确：使用 consumeResult 自动管理租约生命周期
for (const item of items) {
  const task = scope.enqueue('calc', { ... });
  await consumeResult(task, (result) => {
    updateUI(result);
  }); // 退出回调后自动释放租约并还回 outputBytes 额度
}
```

---

### Q3: 为什么大批量任务入队时主线程瞬间卡顿？

**典型反模式**：
```typescript
// ❌ 错误：在循环中直接在闭包外部创建 10,000 个各占 50MB 的大数组
for (let i = 0; i < 10000; i++) {
  const heavyData = new Float64Array(50 * 1024 * 1024 / 8);
  scope.enqueue('compute', {
    pool: 'compute',
    budget: { inputBytes: 50 * 1024 * 1024, scratchBytes: 0, outputBytes: 0 },
    prepare() {
      return { payload: heavyData };
    },
  });
}
```

**原因**：
虽然 tasklane 有并发线程数控制，但如果大数组是在闭包外部生成的，这 10,000 个 50MB 的对象会**瞬间在主线程 JavaScript 堆内存中全部实例化**，立刻导致主线程内存飙升数百 GB，引发剧烈的长垃圾回收暂停（GC Pause）甚至崩溃。

**正确姿势**：
将大数据的分配与构建逻辑**放在 `prepare()` 函数体内**！

```typescript
// ✅ 正确：利用 prepare 延迟构建，真正排到空闲 Worker 时才在主线程生成数据
for (let i = 0; i < 10000; i++) {
  scope.enqueue('compute', {
    pool: 'compute',
    budget: { inputBytes: 50 * 1024 * 1024, scratchBytes: 0, outputBytes: 0 },
    prepare() {
      // 只有当前面任务执行完毕、当前任务获取到 Worker 且内存额度充足时才会执行此函数
      const heavyData = generateChunk(i);
      return { payload: heavyData, transfer: transferBuffers(heavyData) };
    },
  });
}
```

---

## 任务执行与超时

### Q4: 遇到 `EXECUTION_TIMEOUT` 或 `QUEUE_TIMEOUT` 错误是怎么回事？

**原因**：
tasklane 提供了全方位的生命周期超时保护：
- `QUEUE_TIMEOUT`：任务在队列中等待空闲 Worker 或等待内存额度的排队时间超过了 `queueTimeoutMs`；
- `EXECUTION_TIMEOUT`：任务被 Worker 拾取开始执行后，总运行时间超过了 `executionTimeoutMs`。

**解决方案**：
1. 检查 Worker 计算逻辑中是否存在死循环；
2. 对于高耗时的数据处理任务，显式在任务配置中按需放宽超时时间：
   ```typescript
   scope.enqueue('heavy-task', {
     pool: 'compute',
     budget: { inputBytes: 1024, scratchBytes: 0, outputBytes: 1024 },
     executionTimeoutMs: 60_000, // 允许运行 60 秒
     prepare() { ... },
   });
   ```
3. 在长耗时循环中积极插入协作式取消检查点：
   ```typescript
   // Worker 内部
   for (let i = 0; i < total; i++) {
     await ctx.checkpoint(); // 既检测取消，又允许事件循环切片喘息
     doStep(i);
   }
   ```

---

### Q5: 同一个 Worker 实例内能不能并发运行多个任务？

**回答**：
**不能，也不推荐。**
JavaScript 的 Worker 线程本身是单线程事件循环。如果在同一个 Worker 上下文中交叉并发执行耗时 CPU 密集型任务，由于它们都在争抢同一个单线程 CPU 时间片，并不会提高整体吞吐，反而会使任务上下文相互污染并增加排队延迟。

tasklane 采用**线程池隔离（Pool Isolation）**设计：
- 每个 Worker 在同一时刻只严格串行处理一个任务；
- 如需提高并行计算能力，请在创建 Runtime 时增加 Worker 池大小：
  ```typescript
  const runtime = createWorkerRuntime({
    pools: {
      compute: {
        factory: browserWorker(workerUrl),
        size: navigator.hardwareConcurrency ? Math.max(1, navigator.hardwareConcurrency - 1) : 4,
      },
    },
    maxWorkers: 4,
  });
  ```

---

## 环境与工程集成

### Q6: 在 Worker 内部为什么不能访问 `window` 或 `localStorage`？

**原因**：
这是浏览器规范的安全与架构限制。Web Worker 运行在独立的全局作用域（`DedicatedWorkerGlobalScope`），没有 DOM 树访问权限，也没有 `window`、`document`、`localStorage`。

**解决方案**：
1. **数据驱动**：把需要用到的配置从主线程作为 `payload` 传入 Worker；
2. **离线存储**：Worker 内部支持访问标准的 `IndexedDB` 和 `CacheStorage`，可用于直接读取海量离线数据；
3. **网络请求**：Worker 内部完全支持原生的 `fetch` 和 `WebSocket`，可直接在后台线程拉取并解析流式数据。

---

## 高频反模式自查清单 (Anti-patterns Checklist)

| 危险反模式 | 产生的负面后果 | 标准规范对策 |
| :--- | :--- | :--- |
| **在组件每次渲染时 `createWorkerRuntime()`** | 频繁创建和销毁底层线程，迅速耗尽浏览器线程配额与句柄 | 保持单例模式，使用 Context 或模块级导出 |
| **在长耗时循环中不调用 `ctx.checkpoint()`** | 任务无法响应主线程的优雅取消指令，白白浪费电量与 CPU | 每隔固定迭代周期调用一次 `await ctx.checkpoint()` |
| **将具有循环引用或函数的对象作为 payload** | 结构化克隆算法抛出 `DataCloneError` | 仅传递可序列化的纯 JSON 数据或 TypedArray |
| **直接缓存 `task.result` 而不调用 `release()`** | 导致底层 `outputBytes` 额度无法归还，后续任务永久堵塞 | 优先使用 `consumeResult(task, handler)` 自动释放 |
| **忽视组件卸载时的 Scope 销毁** | 页面切换后遗留的 Worker 仍占用 CPU 进行无意义的运算 | 在 `useEffect` 清理函数或 `onUnmounted` 中调用 `scope.dispose()` |
