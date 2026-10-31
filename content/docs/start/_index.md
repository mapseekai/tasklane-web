---
title: "快速开始"
linkTitle: "快速开始"
description: "花 5 分钟跑通第一个后台计算任务，看清主线程与 Worker 如何配合，再接入你的实际项目。"
weight: 10
doc_type: tutorial
---

学习 `tasklane` 最快的方式，就是亲手跑通一个最小例子：主程序提交一个包含三个数字的 `Float64Array([1, 2, 3])`，后台 Worker 把它转换成 `Float32Array`，主程序拿回结果并打印。

跑通这几行代码后，你就能直观理解：计算函数写在哪里、怎么把数据零拷贝传给 Worker，以及怎么安全地拿回结果。如果你还不确定它是否适合你的项目，可以先看一眼[认识 tasklane](/docs/)。

## 按顺序完成以下三步

1. **[安装与运行环境](installation/)**：确认 Node.js 或浏览器版本要求，安装 `@mapseekai/tasklane`。
2. **[第一个 Node.js 任务](node/)（推荐先跑这个）**：无需配置任何前端打包工具，只需新建两个 `.mjs` 文件，执行 `node main.mjs` 就能立刻看到输出。
3. **[浏览器接入](browser/)**：当你准备把后台计算集成到真实的 TypeScript 前端工程（如 Vite / Webpack 项目）时，按这一页的步骤配置 Web Worker 入口。

## 跑通之后怎么读？

- **想看懂例子里的管理代码**：读[Runtime 与 Scope](/docs/concepts/lifecycle/)，了解如何在真实应用中全局复用一个 `Runtime`，并用 `Scope` 管理单个页面或图层。
- **想处理几十兆的大数据**：读[资源预算](/docs/concepts/budgets/)与[结果背压](/docs/concepts/results/)，了解怎样防止大批量任务把内存撑爆。
- **想解决具体工程问题**：直接去[使用指南](/docs/guides/)挑选你需要的场景（如大文件分块读取、中途取消任务、在 Worker 里复用 WASM 或数据库连接）。
