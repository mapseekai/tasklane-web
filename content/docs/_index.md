---
title: "认识 tasklane"
linkTitle: "认识 tasklane"
description: "3 分钟了解 tasklane 解决什么工程痛点、如何运作，以及什么时候适合接入你的项目。"
weight: 10
doc_type: explanation
---

在浏览器或 Node.js 中处理耗时计算（比如转换大批量地图坐标、解析几百 MiB 的数据文件、解码栅格图像或运行 WASM 算法）时，如果直接放在主线程执行，页面交互或服务响应就会卡顿。

把计算移到后台 Worker 线程是标准解法。但只要你在真实项目里手写过原生 `Worker`，很快就会遇到一连串工程难题：

- **线程怎么管？** 每次任务都新建 Worker 太慢，建多了又占内存，怎么按需创建、空闲自动回收？
- **任务怎么排？** 后台正在预取几百个瓦片，用户突然拖动了地图，怎么让当前视口的任务优先插队执行？
- **内存怎么控？** 100 个大数组任务同时塞进队列，或者 Worker 算得太快而主线程来不及消费，内存瞬间飙升甚至崩溃怎么办？
- **怎么干净地取消？** 用户切走了页面或关闭了图层，怎么把排队中、运行中的任务和缓存一次性清理干净？

**`tasklane` 就是为了解决这些问题而设计的轻量级（零运行时依赖）TypeScript 任务运行时。** 你只需要编写纯计算函数，把线程池管理、优先级排队、内存限额控制、零拷贝传输和生命周期清理全部交给它。

## 它是如何工作的？

以“地图页面将一批 64 位浮点坐标转换为 32 位顶点数组”为例，接入 `tasklane` 后，一次任务由三个角色配合完成：

| 角色 | 运行在哪里 | 负责做什么 |
| --- | --- | --- |
| **1. 你的业务调用代码** | 浏览器主线程，或 Node.js 主程序 | 提交任务请求，使用返回的计算结果更新界面，用完后归还结果租约 |
| **2. `tasklane` 运行时** | 与调用代码在同一线程 | 检查内存限额与空闲线程，按优先级排队，把数据发给 Worker 并配对返回结果 |
| **3. 你的计算函数（Handler）** | Worker 后台线程 | 接收输入数据，执行转换算法，把结果返回给主线程 |

整个过程中，你的业务代码不需要手动监听 `onmessage`、不需要维护请求 ID 映射表，也不需要手动管理 Worker 实例的生老病死。

## 你的项目需要接入吗？

你可以根据项目当前的复杂度，快速判断是否适合引入 `tasklane`：

| 你遇到的具体场景 | `tasklane` 怎么帮你解决 | 对应章节 |
| --- | --- | --- |
| **交互卡顿**：后台批量任务堵住了用户当前的点击或拖拽操作 | 将任务分为 `interactive`（交互）、`foreground`（前台）、`background`（后台）三级优先级，并支持同级按分组（`group`）轮流公平执行 | [任务调度](concepts/scheduling/) |
| **内存暴涨**：处理大文件或大数组时，待发送输入和待消费结果把内存撑爆 | 等真正排到空闲 Worker 且内存额度够用时才调用 `prepare()` 构造输入；结果未消费完前自动暂停后续任务准入（背压） | [资源预算](concepts/budgets/)、[结果背压](concepts/results/) |
| **复制太慢**：几兆到几十兆的 `ArrayBuffer` 跨线程传递耗时高 | 提供 `transferBuffers()` 与 `output()`，显式将底层内存所有权零拷贝移交给对方线程 | [数据所有权](concepts/ownership/) |
| **残留难清**：用户频繁切换页面、关闭图层或点击取消按钮 | 支持按任务取消，或通过业务分组（`Scope`）一键取消并清理该模块关联的所有任务、租约和缓存 | [Runtime 与 Scope](concepts/lifecycle/)、[取消与超时](guides/cancellation/) |
| **有状态复用**：Worker 里的 SQLite / DuckDB 连接、GDAL 句柄或 WASM 实例不能丢 | 支持用 `affinity` 优先复用可重建缓存，或用 `Session` 独占绑定同一个 Worker | [Affinity 与 Session](concepts/sessions/)、[状态型计算](guides/sessions/) |

**什么时候不需要用它？**
- 如果你的应用从头到尾只需要跑一两个简单的后台函数，直接用浏览器或 Node.js 原生的 `new Worker()` 就够了；
- 如果是普通的 HTTP 请求或磁盘文件读写，请直接使用平台自带的异步 I/O 接口（如 `fetch` 或 `fs/promises`）。`tasklane` 专注于 CPU 密集型计算与大规模二进制数据流水线。

## 推荐阅读路线

1. **先动手跑通一次（约 5 分钟）**：跟着[第一个 Node.js 任务](start/node/)，复制两个几行代码的 `.mjs` 文件直接运行，亲眼看看数据是怎么送进 Worker 又拿回来的。
2. **接入你的前端项目**：如果要在网页中使用，接着看[浏览器接入](start/browser/)，了解如何配合 Vite / Webpack 等构建工具配置 Web Worker。
3. **理解背后的核心机制**：跑通例子后，阅读[核心概念](concepts/)，搞懂为什么示例里会有 `Runtime`、`Scope`、`budget` 和 `consumeResult`。
4. **按需解决实际问题**：开发过程中遇到大文件分块、异步读取输入、取消任务、WASM 状态保持或单元测试时，直接查[使用指南](guides/)；需要查某个配置项的默认值或错误码时，翻阅[API 参考](reference/)。

## 版本与源码依据

安装要求见[安装与运行环境](start/installation/)（请确保主线程与 Worker 使用相同版本的包）。本站文档严格对应 `tasklane@0.2.0-beta.2`（通信协议 `v7`），依据说明见[文档依据与版本](reference/provenance/)，历次版本演进见 [Blog](/blog/)。

- [Node.js Worker threads 官方文档](https://nodejs.org/docs/latest-v22.x/api/worker_threads.html)：了解计算型任务与异步 I/O 的边界。
- [浏览器适配器源码](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/browser.ts)与[Node.js 适配器源码](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/node.ts)：查看底层 Worker 的创建与消息封装。
- [Runtime 核心源码](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)：查看调度、预算账本与生命周期实现。
