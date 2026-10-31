---
title: "核心概念"
linkTitle: "核心概念"
description: "搞懂 tasklane 背后的核心设计：方案选型对比、生命周期分组、优先级排队、内存预算、零拷贝所有权、结果背压与有状态会话。"
weight: 20
doc_type: explanation
---

在跑通[快速开始](/tasklane-web/docs/start/node/)的小例子后，你已经见过了 `Runtime`、`Scope`、`budget`、`transferBuffers` 和 `consumeResult`。

当你的应用只有一两个简单任务时，你甚至不需要关心它们背后的细节；但当你要处理**成百上千个并发任务、几十兆的大数组，或者多个页面模块共用一套 Worker 池**时，理解下面这些核心概念能帮你避开几乎所有关于内存暴涨、队列卡死和状态泄漏的坑：

- **[与其他方案对比](comparison/)（搞懂选型定位）**：对比原生 Web Worker、Comlink、Piscina、workerpool 与分布式队列，解析 tasklane 的设计定位与适用边界。
- **[Runtime 与 Scope](lifecycle/)（管生命周期）**：为什么整个应用只建一个 `Runtime`，而每个地图、页面或导入弹窗各自建一个 `Scope`？销毁 `Scope` 时到底清理了什么？
- **[任务调度](scheduling/)（管先后顺序）**：当交互任务和后台预取任务同时涌进来时，谁先执行？大任务一直在等内存额度时，怎么防止被小任务无限插队？
- **[资源预算](budgets/)（管内存上限）**：五类字节预算（输入、暂存、输出、缓存、常驻）分别管哪一段内存？协议计费和真实的浏览器/进程内存有什么区别？
- **[数据所有权](ownership/)（管零拷贝传输）**：怎么把大 `ArrayBuffer` 零拷贝移交给 Worker？为什么传一个小切片视图也会按整块底层缓冲区计费？
- **[结果背压](results/)（管消费速度）**：为什么任务返回的不是直接的数据，而是一个必须释放的租约（`ResultLease`）？它怎么防止下游消费太慢把内存撑爆？
- **[Affinity 与 Session](sessions/)（管 Worker 状态）**：如果 Worker 里有缓存或数据库连接，什么时候用软亲和性（`affinity`），什么时候必须用独占会话（`Session`）或副本组（`SessionGroup`）？
