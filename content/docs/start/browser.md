---
title: "浏览器接入"
linkTitle: "浏览器接入"
description: "从页面提交数组，让 Worker 转换，再取回结果。"
weight: 30
doc_type: how-to
---

在已有 TypeScript 前端项目中，页面代码调用 `convertCoordinates()`，把数组交给后台 Worker 转换，再拿到结果 `[1, 2, 3]`。计算函数和[Node.js 入门例子](../node/)完成相同的转换。

本页用于集成到已有项目。构建工具需要解析 npm 导入，并把 Worker 作为独立的 module 产物发布。首次使用时，可以先运行无需前端构建配置的 Node.js 例子。

## 文件分工

| 文件 | 使用位置 | 负责的事 |
| --- | --- | --- |
| `tasks.ts` | 调用端与 Worker 共享 | 声明任务名字、输入类型和输出类型 |
| `compute.worker.ts` | Worker 后台线程 | 注册并执行 `convert` 计算函数 |
| `main.ts` | 页面主线程 | 提交输入，取回结果，关闭本例使用的 Worker |

示例的相对导入和 Worker URL 使用 `.js` 扩展名，适合保留目录结构的 JavaScript 输出。若打包器按源文件创建 Worker，请按其规则把入口改为 `.worker.ts`，并核对最终输出地址。

## 1. 定义输入输出类型

保存为 `tasks.ts`。这里规定 `convert` 接收 `Float64Array`，返回 `Float32Array`。

{{< example "browser/tasks.ts" >}}

## 2. 在 Worker 中放置计算

保存为 `compute.worker.ts`。`Float32Array.from(input)` 是业务计算，你可以将它替换为自己的算法，并同步修改任务类型。

{{< example "browser/compute.worker.ts" >}}

## 3. 从页面提交任务

保存为 `main.ts`，从页面事件中调用 `await convertCoordinates()`。`browserWorker` 指定 Worker 入口，`scope.enqueue` 提交任务，`consumeResult` 把 Worker 返回的数组转成普通数组交给页面。

{{< example "browser/main.ts" >}}

函数返回 `[1, 2, 3]`。调用它的页面代码负责显示或保存这个结果。

## 4. 在项目中验证

在开发和生产构建中分别触发函数，确认返回 `[1, 2, 3]`。在 Network 中核对 Worker URL 返回 JavaScript、MIME 类型正确，且调用端与 Worker 使用相同的 tasklane 版本。加载失败时结合 Console 检查，再查阅[诊断指南](/docs/guides/diagnostics/)。

这个独立演示每次调用创建并关闭一个 Runtime。实际页面通常复用应用级 Runtime，并用 Scope 管理页面或数据集的任务；这部分见[Runtime 与 Scope](/docs/concepts/lifecycle/)。

## 源码与契约

- [src/adapters/browser.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/browser.ts)
- [src/host.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/host.ts)
- [test/contracts.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/test/contracts.ts)
