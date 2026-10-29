---
title: "核心概念"
linkTitle: "核心概念"
description: "建立生命周期、资源额度与数据所有权模型。"
weight: 20
doc_type: explanation
---

tasklane 的约束来自生命周期和资源归属。按下面的顺序理解它们，可以确定谁负责停止任务、何时归还额度，以及哪些状态能够重建。

- [Runtime 与 Scope](lifecycle/)：应用和业务对象的生命周期。
- [任务调度](scheduling/)：优先级、公平性与阻塞原因。
- [资源预算](budgets/)：五类额度的计费与释放边界。
- [数据所有权](ownership/)：复制、transfer 与完整 backing store。
- [结果背压](results/)：消费者持有结果时的准入行为。
- [Affinity 与 Session](sessions/)：可重建缓存与必须保留的状态。
