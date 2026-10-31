---
title: "安装与运行环境"
linkTitle: "安装与运行环境"
description: "安装 @mapseekai/tasklane，了解主线程与 Worker 端的导入入口及环境要求。"
weight: 10
doc_type: how-to
---

在你的项目中安装 `@mapseekai/tasklane`。无论是主线程的调度代码，还是 Worker 线程里的处理代码，都来自这同一个 npm 包（通过不同的子路径导入），因此只需要安装一次。

推荐安装与当前文档完全对应的固定版本：

```sh
npm install @mapseekai/tasklane@0.2.0-beta.2
```

如果你想跟随最新的 beta 通道，也可以运行 `npm install @mapseekai/tasklane@beta`，并通过项目的 `package-lock.json` 或 `pnpm-lock.yaml` 锁定实际安装的版本。

## 四个导入入口与环境要求

`@mapseekai/tasklane` 没有任何第三方运行时依赖。为了让浏览器打包时不混入 Node.js 模块，它将不同环境的代码拆分在四个入口中：

| 你在写哪部分代码 | 导入路径 | 环境要求 | 常用导出函数 |
| --- | --- | --- | --- |
| **浏览器主线程** | `@mapseekai/tasklane` | 支持 Web Worker（推荐 module Worker）与 `structuredClone` | `createWorkerRuntime`、`browserWorker`、`consumeResult`、`transferBuffers` |
| **Node.js 主线程** | `@mapseekai/tasklane` + `@mapseekai/tasklane/node` | Node.js 22+（支持原生 ESM 与 `worker_threads`） | `createWorkerRuntime`、`nodeWorker`、`nodeEndpoint` |
| **Worker 后台线程** | `@mapseekai/tasklane/host`（Node 下配合 `/node`） | 与主线程保持**完全相同**的包版本 | `serve`、`output`、`browserHost`、`nodeHost` |
| **单元测试代码** | `@mapseekai/tasklane/testing` | 任意现代 JS 运行环境 | `createLoopback`（无需起真实线程即可测试完整契约） |

## 集成前必须留意的两件事

1. **主线程与 Worker 必须同版本**：如果前端工程把主程序和 Worker 分别独立构建，升级时必须一起重新打包发布。Worker 启动时会与主线程核对通信协议版本（当前为 `v7`），版本不一致会直接报错 `PROTOCOL_ERROR`。
2. **默认使用 Module Worker**：在浏览器中，`browserWorker(url)` 默认以 `{ type: 'module' }` 启动 Worker。如果你的旧版构建工具只能产出传统的 classic 脚本，需要显式传入 `browserWorker(url, { type: 'classic' })`，并把 `@mapseekai/tasklane/host` 一起打包进 Worker 文件里。

## 从源码构建（可选）

如果你只是在自己的项目里使用 `tasklane`，完成上面的 `npm install` 后就可以直接跳到下一步：[第一个 Node.js 任务](../node/)。

如果你想克隆 `tasklane` 源码仓库来运行内置示例或基准测试（需 Node.js 22+ 与 pnpm）：

```sh
git clone https://github.com/mapseekai/tasklane.git
cd tasklane
pnpm install --frozen-lockfile
pnpm build
node examples/node.mjs
```

## 源码与契约

- [package.json](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/package.json)
- [src/adapters/browser.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/browser.ts)
- [src/adapters/node.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/node.ts)
