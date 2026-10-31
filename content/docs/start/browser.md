---
title: "浏览器接入"
linkTitle: "浏览器接入"
description: "在 TypeScript 前端工程中共享任务类型、配置 Web Worker 入口，并从页面发起后台计算。"
weight: 30
doc_type: how-to
---

本篇指南说明如何在现有的 TypeScript 前端工程（如 Vite、Webpack 5 或 Rollup 项目）中接入 `tasklane`。我们要实现的计算逻辑与[第一个 Node.js 任务](../node/)完全相同：页面调用 `convertCoordinates()`，把 `Float64Array([1, 2, 3])` 交给浏览器 Web Worker 转成 `Float32Array`，最后拿回普通数组 `[1, 2, 3]`。

### 开始前请确认

- 已在前端项目中[安装 `@mapseekai/tasklane`](../installation/)；
- 项目的打包工具支持标准的 `new URL('./xxx.worker.js', import.meta.url)` 语法来构建独立 Worker 文件。

## 推荐的三文件结构

在 TypeScript 前端项目中，最佳实践是把代码分成三个文件：**一个纯类型文件 + 一个 Worker 文件 + 一个主线程调用文件**。这样主线程和 Worker 都能获得完整的类型提示，同时又不会把对方的运行时代码错误地打包进来：

| 文件名 | 运行在哪里 | 作用 |
| --- | --- | --- |
| `tasks.ts` | 主线程与 Worker 共享 | 仅用 `TaskType<Input, Output>` 声明任务名叫什么、入参和返回值是什么类型 |
| `compute.worker.ts` | 浏览器 Web Worker 线程 | 用 `browserHost(self)` 连接当前 Worker，实现具体的 `convert` 计算函数 |
| `main.ts` | 页面主线程 | 用 `browserWorker(url)` 指定 Worker 地址，提交任务并读取结果 |

> **小贴士：关于 `.js` 与 `.ts` 导入后缀**
> 下方代码按照标准 TypeScript ESM 规范（`moduleResolution: "bundler"` 或 `"nodenext"`）编写，因此在 `import` 和 `new URL(...)` 中写了 `.js` 后缀。如果你的打包器（例如部分 Vite 配置）要求在 `new URL` 里直接写 `.ts` 源文件名，只需将 `./compute.worker.js` 改为 `./compute.worker.ts` 即可。

## 1. 定义共享任务类型（`tasks.ts`）

新建 `tasks.ts`，声明任务 `convert` 接收 `Float64Array` 并返回 `Float32Array`。因为这里只有 `type`，编译后不会产生任何多余的 JS 代码：

{{< example "browser/tasks.ts" >}}

## 2. 编写 Web Worker 脚本（`compute.worker.ts`）

新建 `compute.worker.ts`。把 `Tasks` 泛型传给 `serve<Tasks>` 后，TypeScript 会自动推导出 `input` 是 `Float64Array`，并检查你的返回值是否符合 `Float32Array`：

{{< example "browser/compute.worker.ts" >}}

接入真实业务时，直接把 `Float32Array.from(input)` 替换成你的坐标投影、几何三角剖分或像素处理代码即可。

## 3. 从页面主线程发起调用（`main.ts`）

新建 `main.ts`，编写供页面按钮或组件调用的 `convertCoordinates()` 函数：

{{< example "browser/main.ts" >}}

这里额外加了 `priority: 'interactive'`，表示这是一个需要立即响应用户当前操作的最高优先级任务。

## 4. 在浏览器中运行与排查

启动前端开发服务器，在页面中调用 `await convertCoordinates()`：

1. **核对返回值**：拿到结果 `[1, 2, 3]`。
2. **核对 Network 请求**：打开浏览器开发者工具的 **Network** 面板，确认 `compute.worker` 脚本返回 `200`，且响应头 `Content-Type` 是 JavaScript（而不是因为路径写错被开发服务器回退成了 `text/html` 首页）。
3. **如何在真实页面中复用 `Runtime`？**
   上面的 `convertCoordinates()` 为了方便独立演示，在每次调用时新建并销毁了 `Runtime`。在实际前端应用中，你应该**在应用初始化时创建一个全局 `Runtime` 实例**，然后在组件挂载或打开某个数据集时调用 `runtime.createScope()`，在组件卸载时调用 `scope.dispose()`。如果你正在使用 React 或 Vue 3，可直接参考[主流前端框架集成](/tasklane-web/docs/guides/frameworks/)；关于作用域生命周期的底层机制，请参阅[Runtime 与 Scope](/tasklane-web/docs/concepts/lifecycle/)。

## 源码与契约

- [src/adapters/browser.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/browser.ts)
- [src/host.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/host.ts)
- [test/contracts.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/test/contracts.ts)
