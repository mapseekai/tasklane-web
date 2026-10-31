# 内容模型与写作规范

本文档记录 `tasklane-web` 的信息架构与内容治理原则。整站面向 JavaScript / TypeScript 开发者，采用 Diátaxis 框架将学习教程、原理阐述、操作指南与接口字典严格分离，避免在同一页面内混杂多种文档模式。

## Diátaxis 四象限与栏目分工

| 站点路径 | `doc_type` | Diátaxis 象限 | 目标读者意图 | 写作边界与要求 |
| --- | --- | --- | --- | --- |
| `content/docs/_index.md` | `explanation` | 概览与路由入口 | 了解 `tasklane` 解决什么问题、是否适合自己的项目 | 用典型场景说明主线程、Runtime 与 Worker 的职责分工，引导至具体章节 |
| `content/docs/start/node.md` | `tutorial` | Tutorial（新手教程） | 从零跑通第一个可观察结果的后台计算任务 | 单一确定性路径，使用可运行的 `examples/node/` 源文件，逐步拆解核心调用 |
| `content/docs/start/installation.md`、`browser.md` | `how-to` | How-to Guide（接入指南） | 在目标 Node.js 或前端构建环境中完成安装与配置 | 明确平台前提、导出入口、TypeScript 类型共享与打包器 Worker URL 约定 |
| `content/docs/concepts/` | `explanation` | Explanation（概念解析） | 理解生命周期树、调度公平性、五类预算、所有权、背压与会话 | 重点回答“为什么这样设计”与权衡边界，不混入版本演进历史 |
| `content/docs/guides/` | `how-to` | How-to Guide（操作指南） | 解决异步准备、取消、分块流、状态会话、压力调节、诊断与测试问题 | 围绕具体工程目标提供完整模式代码，明确调用方与 Worker 端的责任边界 |
| `content/docs/reference/` | `reference` | Reference（技术参考） | 开发时查阅精确的函数签名、配置项默认值、计费规则与错误码 | 结构化表格配合 `assets/reference/` 类型快照，覆盖全部公共接口与 16 个错误码 |
| `content/docs/architecture/` | `explanation` | Explanation（架构设计） | 评估内部模块划分、状态机时序、协议 `v7` 与释放屏障 | 图示严格对应真实源码模块，不将单文件内协调逻辑虚构为独立微服务 |
| `content/blog/releases/` | `historical` | Historical（版本归档） | 核对历次版本演进与升级兼容性要求 | 提供清晰的中文变化摘要，并完整保留原始 `CHANGELOG.md` 英文记录与日期 |

## 导航、元数据与单一事实来源

1. **导航层级**：顶栏固定保留 `Home`、`Docs`、`Blog` 三个一级入口；文档侧边栏由 OINK 主题按目录层级与 `weight` 自动生成，路径深度不超过三层。
2. **Front Matter 强校验**：除首页 `content/_index.md` 外，所有 Markdown 页面必须包含 `title`、`description` 与合法的 `doc_type`（`tutorial` \| `how-to` \| `reference` \| `explanation` \| `historical`），由 `scripts/check-site.py` 自动检查。
3. **单一事实来源**：
   - 运行时版本（`0.2.0-beta.2`）、源码 commit 与协议版本（`v7`）统一固定在 `data/upstream.json`；
   - 教程代码统一维护在 `examples/` 下，通过 `{{< example >}}` 短代码嵌入页面，并由 `pnpm check:examples` 执行类型检查与真实 Node.js Worker 断言；
   - API 类型声明快照统一维护在 `assets/reference/` 下，通过 `{{< type-source >}}` 短代码嵌入参考页。
