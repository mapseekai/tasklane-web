---
title: "认识 tasklane"
linkTitle: "认识 tasklane"
description: "了解这个 JS/TS 后台计算任务库的用途、工作方式和接入场景。"
weight: 10
doc_type: explanation
---

tasklane 是一个 JavaScript / TypeScript 库，用来把耗时计算作为任务交给后台线程执行。它基于浏览器的 Web Worker 和 Node.js 的 `worker_threads`，管理 Worker 的创建与复用、任务排队、并发以及取消。

你编写自己的计算函数，例如解析文件、转换坐标数组或处理像素。tasklane 把输入送到 Worker，让对应函数执行，再把结果交回调用端。库随你的应用运行，计算发生在应用创建的本机 Worker 中。

## 一次坐标转换的过程

假设地图页面要转换一批坐标。计算放在负责页面交互的主线程中时，会占用它处理其他操作的时间。使用 Worker 后，转换函数在另一个线程执行，页面等待返回的数据，再更新地图。

这条流程中的职责如下：

| 角色 | 运行位置 | 负责的事 |
| --- | --- | --- |
| 调用端 | 页面主线程，或 Node.js 业务代码 | 提交输入，使用返回结果 |
| tasklane 管理器 | 与调用端同一侧 | 管理 Worker，安排任务，匹配返回结果 |
| 计算函数 | Worker 后台线程 | 执行你编写的算法，返回数据 |

Worker 提供独立执行计算的线程。tasklane 在这之上提供任务层面的管理：应用可以持续提交任务，由配置决定并发数量、排队和资源限制。文件如何分块、算法怎样实现、结果怎样显示或保存，由你的应用决定。

## 适合接入的应用

当应用反复提交计算任务，需要管理多个 Worker 或控制同时处理的数据量时，可以使用 tasklane。

| 你的需求 | tasklane 提供的管理 | 继续阅读 |
| --- | --- | --- |
| 一批计算需要排队执行 | 复用 Worker，并按配置限制并发 | [任务调度](concepts/scheduling/) |
| 输入或结果很大 | 声明资源额度，在可以处理时再准备输入 | [资源预算](concepts/budgets/) |
| 用户会取消任务或切换数据集 | 按任务或业务组选择取消和清理方式 | [取消与超时](guides/cancellation/) |
| WASM 实例或数据句柄需要重复使用 | 将一组操作绑定到同一个 Worker | [状态型计算](guides/sessions/) |

单个简单后台函数可以直接使用平台的 Worker API。普通 HTTP 请求通常先使用平台已有的异步接口。tasklane 适合管理计算任务；是否缩短总耗时，还需要结合计算规模和数据传输开销测量。

资源额度按协议计费量和应用声明进行管理，实际内存的测量与限制见[资源预算](concepts/budgets/)。

## 先跑通一次，再深入

[第一个 Node.js 任务](start/node/)用两个文件演示完整流程：提交三个数，Worker 转换数组，调用端打印结果并关闭 Worker。这个例子用于理解线程之间怎样交接任务。

在前端项目中使用时，再跟随[浏览器接入](start/browser/)放置 Worker 入口和调用代码。已有计算函数需要迁移到 Worker 时，从这里接入。

跑通后，按实际问题阅读[使用指南](guides/)。[核心概念](concepts/)解释示例中的 Runtime、Scope 和资源管理；[API 参考](reference/)用于查参数；[架构设计](architecture/)说明内部实现。

## 版本与依据

安装版本和环境要求见[安装与运行环境](start/installation/)。主线程与 Worker 应使用同一版本的包。[文档依据](reference/provenance/)记录本站对应的源码版本，[Blog](/blog/)保留历史变更。

- [Node.js Worker threads](https://nodejs.org/docs/latest-v22.x/api/worker_threads.html)：计算型任务与异步 I/O 的使用边界。
- [浏览器适配器](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/browser.ts)与[Node.js 适配器](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/node.ts)：Worker 的创建与消息传输。
- [运行时实现](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)：任务、Worker 和资源管理。
