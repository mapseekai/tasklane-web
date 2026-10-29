---
title: "浏览器接入"
linkTitle: "浏览器接入"
description: "把带类型的任务目录接入 module Worker。"
weight: 30
doc_type: how-to
---

在已有的 TypeScript 项目中创建下面三个文件。构建流程需要解析 npm 导入，并将 Worker 作为独立的 module 产物发布。

示例使用 `.js` 作为相对导入与 Worker URL，适合按目录输出 JavaScript 的 TypeScript 构建。若使用会重写 Worker 入口的打包器，请按其规则把 URL 指向源入口，例如 `.worker.ts`，并验证生产构建中的 Worker 地址。

## 定义任务目录

保存为 `tasks.ts`。调用端和 Worker 共享输入输出类型。

{{< example "browser/tasks.ts" >}}

## 注册处理函数

保存为 `compute.worker.ts`。业务计算在 Worker 内运行。

{{< example "browser/compute.worker.ts" >}}

## 在调用端提交

保存为 `main.ts`，从你的页面事件中调用 `await convertCoordinates()`。函数返回 `[1, 2, 3]`。

{{< example "browser/main.ts" >}}

示例每次调用创建并关闭一个 Runtime，便于验证生命周期。应用集成时通常由应用持有一个长期 Runtime，各页面或数据集创建自己的 Scope。

## 验证产物

在开发和生产环境分别触发函数，确认 Worker URL 返回 JavaScript、MIME 类型正确，且输入输出版本一致。Worker 加载失败时先检查 Network 与 Console，再查阅[诊断指南](/docs/guides/diagnostics/)。

## 源码与契约

- [src/adapters/browser.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/browser.ts)
- [src/host.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/host.ts)
- [test/contracts.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/test/contracts.ts)
