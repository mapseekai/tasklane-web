---
title: "文档"
linkTitle: "文档"
description: "从第一个任务开始，逐步掌握有界 Worker 运行时。"
weight: 10
doc_type: explanation
---

tasklane 在 Web Workers 与 Node.js `worker_threads` 上提供统一的任务模型。先完成一个可运行的例子，再查阅与你的资源生命周期有关的契约。

| 你要完成的事 | 阅读入口 | 内容类型 |
| --- | --- | --- |
| 运行首个任务 | [快速开始](start/) | 教程 |
| 理解任务和数据由谁持有 | [核心概念](concepts/) | 解释 |
| 接入文件、取消或长期状态 | [使用指南](guides/) | 操作指南 |
| 查询配置、签名和错误码 | [API 参考](reference/) | 参考 |
| 评估模块边界与失败处理 | [架构设计](architecture/) | 解释 |

## 阅读范围

文档对应 `0.2.0-beta.2` 的 API 和 Worker 协议 v7。主线程与 Worker 必须使用同一版本的包。[版本记录](/blog/)列出历史变化，[文档依据](reference/provenance/)记录源码来源。

预算限制的是协议计费量与应用声明的资源。JS 堆、WASM 堆、GPU 内存及实际 RSS 需要另行测量。
