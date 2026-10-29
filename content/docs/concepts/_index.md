---
title: "核心概念"
linkTitle: "核心概念"
description: "理解运行示例中的任务管理器、业务分组和数据交接。"
weight: 20
doc_type: explanation
---

运行过[第一个任务](/docs/start/node/)后，再读这一组解释。Runtime 是管理 Worker 和任务的对象；Scope 把同一页面、数据集或业务操作的任务归在一起，方便统一清理。其余章节解释任务如何排队，以及大量数据在计算前后由谁持有。

- [Runtime 与 Scope](lifecycle/)：应用和业务对象的生命周期。
- [任务调度](scheduling/)：优先级、公平性与阻塞原因。
- [资源预算](budgets/)：五类额度的计费与释放边界。
- [数据所有权](ownership/)：复制、transfer 与完整 backing store。
- [结果背压](results/)：消费者持有结果时的准入行为。
- [Affinity 与 Session](sessions/)：可重建缓存与必须保留的状态。
