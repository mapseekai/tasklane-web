---
title: "安装与运行环境"
linkTitle: "安装与运行环境"
description: "锁定包版本，区分消费者与源码开发的环境要求。"
weight: 10
doc_type: how-to
---

将 tasklane 安装到提交计算任务的应用中。Worker 处理文件也使用同一版本的包。以下命令安装本文示例使用的确定版本：

```sh
npm install @mapseekai/tasklane@0.2.0-beta.2
```

需要跟随 beta 通道时使用 `npm install @mapseekai/tasklane@beta`，并在自己的锁文件中固定实际解析版本。当前文档对应的版本来自仓库 `package.json`；站点构建不查询 npm 通道状态。

## 平台要求

| 使用方式 | 前提 | 集成入口 |
| --- | --- | --- |
| Node.js 消费端 | Node.js 22+，ESM | `@mapseekai/tasklane/node` |
| 浏览器消费端 | Web Worker、module Worker、structuredClone 与所需 Transferable | `@mapseekai/tasklane` |
| Worker 处理端 | 与调用端使用相同的 tasklane 版本 | `@mapseekai/tasklane/host` |
| 源码开发 | Node.js 22+、pnpm 11.15.1 | 仓库脚本 |

浏览器的具体支持情况取决于你使用的 API，例如 File、Blob 和特定 Transferable。部署前在目标浏览器验证自己的任务。

## 从源码构建

```sh
git clone https://github.com/mapseekai/tasklane.git
cd tasklane
pnpm install --frozen-lockfile
pnpm build
node examples/node.mjs
```

源码与 npm 包的 Worker 产物应作为同一个发布单元升级。下一步运行[第一个 Node.js 任务](../node/)。

## 源码与契约

- [package.json](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/package.json)
- [src/adapters/browser.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/browser.ts)
- [src/adapters/node.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/node.ts)
