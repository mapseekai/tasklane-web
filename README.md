# tasklane-web

[在线网站](https://mapseekai.github.io/tasklane-web/) | [在线文档](https://mapseekai.github.io/tasklane-web/docs/) | [tasklane 运行时仓库](https://github.com/mapseekai/tasklane)

`tasklane-web` 是面向 JavaScript / TypeScript 开发者的 `tasklane` 官方中文文档网站。站点采用 `Home`、`Docs`、`Blog` 导航结构：首页展示核心任务与资源治理模型，文档区遵循 Diátaxis 框架分为快速开始、核心概念、使用指南、API 参考与架构设计，博客区归档六个真实发布版本的变更记录。正文采用简体中文编写，公共 API 符号与配置名保持英文原名。

本站基于 [OINK v1.4.0](https://github.com/pgsty/oink/tree/v1.4.0) 主题模块与 Hugo Extended 构建，采用 Hallmark Cobalt 视觉设计系统。运行时实现代码独立维护于 `tasklane` 仓库中。

## 本地预览

本地构建与预览需要 **Hugo Extended 0.169.0**（最低要求 `0.168.0`）与 **Go 1.27+**。仅预览静态页面无需安装 Node.js 依赖：

```sh
git clone https://github.com/mapseekai/tasklane-web.git
cd tasklane-web
go mod download
hugo server --renderToMemory --baseURL http://localhost:1314/ --bind 127.0.0.1 --port 1314
```

启动后在浏览器访问 [http://localhost:1314/](http://localhost:1314/)。开发服务器使用 `--renderToMemory` 在内存中渲染，不会覆盖磁盘上的 `public/` 生产构建目录。

## 完整验证（`pnpm check`）

运行代码示例检查与全站静态验证需要 **Node.js 22+（ESM）**、**pnpm 11.15.1** 与 **Python 3**：

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
```

`pnpm check` 会依次执行三项自动化检查：
1. **`pnpm build`**：使用 Hugo Extended 执行生产环境构建并输出至 `public/`；
2. **`pnpm check:links`**：运行 `python3 scripts/check-site.py public`，解析全部生成的 HTML 页面，检查 `title` / `description` / `doc_type` 元数据、唯一 `h1`、无重复元素 `id`，并验证所有内部链接、静态资源与 `#anchor` 锚点 100% 有效；
3. **`pnpm check:examples`**：运行 `tsc --noEmit` 检查 `examples/browser/` 与 `examples/node/` 的类型契约，并执行 `node examples/node/main.mjs` 验证真实 Node.js `worker_threads` 下的 `Float64Array` 转 `Float32Array` 结果及租约/作用域/线程归零断言。

链接检查器自身的回归自测可通过以下命令运行：

```sh
python3 scripts/check-site.py --self-test
```

更多关于内容架构与本地验收记录的说明，请参见 [内容模型与写作规范](docs/CONTENT-MODEL.md) 与 [本地验证报告](docs/VERIFICATION.md)。

## 内容目录结构

| 路径 | 栏目名称 | Diátaxis 类型 | 承载内容 |
| --- | --- | --- | --- |
| `content/docs/start/` | 快速开始 | `tutorial` / `how-to` | 环境安装、第一个 Node.js 任务教程与浏览器 TypeScript 项目接入 |
| `content/docs/concepts/` | 核心概念 | `explanation` | `Runtime` 与 `Scope` 生命周期、优先级与公平调度、五类预算、数据所有权、`ResultLease` 背压、`Affinity` 与 `Session` |
| `content/docs/guides/` | 使用指南 | `how-to` | `enqueuePrepared` 异步准备、取消与超时、大文件分块迭代、状态型 `Session`、内存压力与资源调度、故障诊断、自动化测试 |
| `content/docs/reference/` | API 参考 | `reference` | 四个公共导出入口的完整配置表、方法签名、类型快照、16 个稳定错误码与诊断结构 |
| `content/docs/architecture/` | 架构设计 | `explanation` | 模块分层、任务状态机与执行时序、协议 `v7` 规范、资源释放屏障与文档站架构 |
| `content/blog/releases/` | 版本记录 | `historical` | `0.1.0-beta.1` 至 `0.2.0-beta.2` 的中文变更导读与原始 `CHANGELOG` 归档 |

## 源码快照与示例同步机制

- `data/upstream.json` 固定记录当前文档所依据的 `tasklane` 版本（`0.2.0-beta.2`）、源码 commit（`b40ba606552c4b798ebb803528548151186b364b`）与 Worker 协议版本（`v7`）。
- `assets/reference/*.ts` 存放与源码同步的公共接口声明快照，由参考页通过 `{{< type-source >}}` 短代码直接引用。
- `examples/` 存放可执行的教程源码，由教程页通过 `{{< example >}}` 短代码直接引用，确保读者看到的代码与 `pnpm check:examples` 实际运行的代码完全一致。

## 部署与许可

- 本站通过 GitHub Actions（`.github/workflows/verify.yml`）自动构建并部署至 GitHub Pages（`https://mapseekai.github.io/tasklane-web/`）。
- 站点源码采用 MIT 许可证；OINK 主题模块采用 Apache-2.0 许可证；`tasklane` 运行时采用 MIT 许可证。第三方组件与技能的来源及许可声明详见 [`NOTICE.md`](NOTICE.md)。
