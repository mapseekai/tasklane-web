---
title: 核心术语表
description: 统一收录 tasklane 系统设计中的核心概念、术语定义与英文缩写速查。
weight: 10
doc_type: reference
---

为了帮助开发者在阅读源码、架构文档或调试异常时准确理解系统行为，本词汇表按字母顺序列出了 tasklane 中的核心概念、缩写及权威定义。

---

## 字母速查索引

[B](#b) · [C](#c) · [D](#d) · [E](#e) · [F](#f) · [P](#p) · [R](#r) · [S](#s) · [T](#t) · [W](#w)

---

## B

### Backpressure（背压）
- **定义**：当任务产生或投递的速率超过底层 Worker 线程池的处理能力时，系统所采取的限流与缓冲机制。
- **物理机制**：tasklane 不会无底线地扩张内存队列，而是在达到阈值时暂停接收新任务、或者触发降级与拒收策略，避免主线程或工作线程发生 OOM 崩溃。
- **关联参考**：[调度与排队机制](/tasklane-web/docs/concepts/scheduling/)。

### Budgets（五类资源预算）
- **定义**：调度器全局账本（`BudgetLedger`）对任务和线程池施加的五维内存字节约束契约。
- **构成维度**：
  1. `inputBytes`：主线程发往 Worker 的输入数据字节上限（任务准入时扣除，Worker 运行结束时归还）；
  2. `scratchBytes`：Worker 算法执行期间申请的临时内存空间上限（任务准入时扣除，任务结算时回收归还）；
  3. `outputBytes`：Worker 算出的结果数据字节上限（任务准入时扣除，主线程消费完并释放租约后归还）；
  4. `cacheBytes`：Worker 线程内部持久缓存（`ctx.cache`）的容量上限（线程扩容时扣除，缩容或销毁时归还）；
  5. `residentBytes`：跨任务长期持有的常驻内存租约（`ResourceLease` / `Session`）上限（获取常驻资源时扣除，显式释放或 Scope 销毁时归还）。
- **关联参考**：[资源预算模型](/tasklane-web/docs/concepts/budgets/)。

---

## C

### Checkpoint（协作式取消检查点）
- **定义**：在 Worker 内部耗时循环或多步流水线中调用的让步方法 `await ctx.checkpoint()`。
- **物理机制**：该方法会检查主线程是否已下发取消信号（AbortSignal）。如果已取消，立即抛出中断异常跳出执行；如果未取消，将执行权短暂归还 JavaScript 事件循环微任务队列，防止长时间卡死 Worker 线程。
- **关联参考**：[取消机制与中断控制](/tasklane-web/docs/guides/cancellation/)。

---

## D

### Disposition（处置策略）
- **定义**：当任务发生超时、内存超限或主线程主动销毁 Scope 时，调度器对该任务采取的处理动作。
- **策略类型**：包括 `ABORT`（硬性终止并重置环境）、`DRAIN`（允许当前正在进行的子步骤完成）与 `DISCARD`（静默丢弃未执行的排队任务）。

---

## E

### Epoch（纪元）
- **定义**：用于追踪数据租约生命周期与有效期的递增序列计数器。
- **物理机制**：调度器或会话在重置、清理或垃圾回收时，纪元计数器递增。若持有旧纪元租约（Stale Epoch）的代码尝试读取底层缓冲区，系统会抛出纪元失效异常，杜绝“使用已释放内存”的隐患。
- **关联参考**：[结果提取与租约生命周期](/tasklane-web/docs/concepts/results/)。

### ExecutionScope（执行作用域）
- **定义**：一组具有相同生命周期或业务关联的任务集合容器。
- **物理机制**：通过 `host.createScope()` 派生。当组件卸载或用户离开当前交互视图时，调用 `scope.dispose()` 可一次性级联取消该容器内所有排队中与正在运行的任务。

---

## F

### Footprint（内存足迹）
- **定义**：任务在传输过程及驻留执行期间所占用的实际物理字节数总量。
- **物理机制**：包含结构化克隆对象的序列化估算体积与 Transferable 对象的 `byteLength` 之和，是五类预算实施拦截的关键依据。

---

## W

### WorkerRuntime（工作线程运行时）
- **定义**：运行在主线程（浏览器 UI 线程或 Node.js 主事件循环）的中心调度实例，由 `createWorkerRuntime()` 创建。
- **职责**：维护底层 Worker 线程池池化管理、并发槽位分配、五类预算账本（`BudgetLedger`）预检、背压排队控制以及结果租约的派发与回收。
- **关联参考**：[Runtime 与 Pool 配置参考](/tasklane-web/docs/reference/runtime/)。

---

## P

### Payload（任务载荷）
- **定义**：主线程派发任务时传递给 Worker 的业务参数主体。
- **规范**：必须是可通过 Web 结构化克隆算法（Structured Clone Algorithm）安全复制的数据类型，不得包含函数、DOM 元素或包含循环引用的复杂对象。

### Prepare（延迟准备函数）
- **定义**：任务派发配置项中的 `prepare?: () => { payload, transfer }` 闭包。
- **物理机制**：避免主线程在排队阶段过早实例化大体积对象。调度器仅在为任务正式分配到空闲 Slot 槽位并即将发车前，才会同步触发 `prepare` 函数生成数据。
- **关联参考**：[冷启动与任务准备优化](/tasklane-web/docs/guides/preparation/)。

### Provenance（血统溯源）
- **定义**：主线程与 Worker 之间在握手阶段强制执行的协议版本一致性与构建元数据校验。
- **物理机制**：确保两端运行的通信协议版本一致，若主线程版本升级而浏览器缓存了旧版本 Worker 脚本，握手立即阻断并给出明确升级指引。
- **关联参考**：[协议与版本血统溯源](/tasklane-web/docs/reference/provenance/)。

---

## R

### ResultLease（结果租约）
- **定义**：任务执行成功后返回给调用方的安全数据访问凭证。
- **物理机制**：封装了计算产生的结果对象，并提供了 `retain()` 延续持有和 `release()` 主动释放方法。在租约未释放前，底层传输缓冲受到锁定保护；释放后资源立即归还。
- **关联参考**：[结果提取与租约生命周期](/tasklane-web/docs/concepts/results/)。

### RuntimeContext（运行时上下文）
- **定义**：Worker 线程内部执行具体任务函数时所注入的句柄对象 `ctx`。
- **职责**：提供 `ctx.checkpoint()` 取消检查、`ctx.reportProgress()` 进度上报、以及访问当前任务预算限额的只读接口。
- **关联参考**：[Runtime 上下文接口参考](/tasklane-web/docs/reference/runtime/)。

---

## S

### Slot（并发槽位）
- **定义**：代表底层一个独立 Worker 线程的物理执行通道。
- **物理机制**：由线程池大小（`pool.size`）与全局 `maxWorkers` 决定。当所有 Worker 槽位均处于活跃计算状态时，后续任务自动进入背压排队队列，直到前置任务结算归还槽位。

---

## T

### Transferable（可转移对象）
- **定义**：符合 Web 标准的零拷贝可转移对象（如 `ArrayBuffer`、`MessagePort`、`ImageBitmap`、`OffscreenCanvas`）。
- **物理机制**：在跨线程传递时不执行内存复制，而是直接转移内存指针所有权。转移后原所有者上下文中的引用立即失效（剥离）。
- **关联参考**：[所有权与 Transferable 机制](/tasklane-web/docs/concepts/ownership/)。
