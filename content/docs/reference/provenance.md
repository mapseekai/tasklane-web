---
title: "文档依据与版本"
linkTitle: "文档依据与版本"
description: "说明本站文档所依据的 tasklane 源码快照、类型与示例同步机制以及验证结论边界。"
weight: 90
doc_type: reference
---

本网站的所有功能描述、参数默认值、协议行为与错误码均严格锚定于 `data/upstream.json` 记录的 `tasklane` 源码快照：

- **固定包版本**：`@mapseekai/tasklane@0.2.0-beta.2`
- **固定源码提交**：[`b40ba606552c4b798ebb803528548151186b364b`](https://github.com/mapseekai/tasklane/tree/b40ba606552c4b798ebb803528548151186b364b)
- **固定 Worker 协议版本**：`v7`

## 事实来源映射表

| 文档内容类别 | 权威事实来源 | 站点内的同步位置 |
| --- | --- | --- |
| 包版本、导出入口与运行要求 | [package.json](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/package.json)、[src/index.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/index.ts) | `data/upstream.json`、`package.json`、[安装与运行环境](/docs/start/installation/) |
| 公共 TypeScript 接口与默认参数 | [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)、[src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts) | `assets/reference/*.ts`（通过 `type-source` 短代码嵌入各参考页） |
| 教程可运行代码 | 本站 `examples/node/` 与 `examples/browser/` | 通过 `example` 短代码嵌入[快速开始](/docs/start/)，并由 `pnpm check:examples` 执行编译与运行断言 |
| 预算计费、清理屏障与协议契约 | [docs/resources.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resources.md)、[docs/resource-scheduling.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resource-scheduling.md)、[src/protocol.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/protocol.ts) | [核心概念](/docs/concepts/)、[使用指南](/docs/guides/)与[架构设计](/docs/architecture/) |
| 历次版本变更记录 | [CHANGELOG.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/CHANGELOG.md) | `content/blog/releases/`（保留原始日期与英文变更条目） |
| 文档阅读主题与构建基线 | [OINK v1.4.0](https://github.com/pgsty/oink/tree/v1.4.0)、Hugo Extended 0.169.0 | `go.mod`、`hugo.yaml`、[文档网站架构](/docs/architecture/website/) |

## 验证范围与结论边界

- **文档站检查（`pnpm check`）**：验证本站的 Hugo 静态构建、全站 HTML 本地链接与锚点完整性、front matter 元数据规范，以及 `examples/` 下的 TypeScript 类型检查与 Node.js 真实 Worker 冒烟示例。
- **运行时仓库验证**：关于 Node.js 22/24 全量单元与故障注入测试、Chrome / Firefox / WebKit 三浏览器 Playwright 持续负载验证及 1 GiB 流式坐标压力测试的记录，归属于 `tasklane` 运行时仓库的 [`docs/testing.md`](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/testing.md) 与 [`docs/performance.md`](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/performance.md)。
- **业务上线评估**：运行时提供的字节预算与自适应调节是基于协议计费量与显式申报值的有界治理机制；业务应用在接入生产环境前，仍应结合自身的目标设备、真实数据集与浏览器内核实测端到端延迟与进程物理内存（RSS）。
