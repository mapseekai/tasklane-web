# tasklane-web

[网站](https://mapseekai.github.io/tasklane-web/) | [文档](https://mapseekai.github.io/tasklane-web/docs/) | [tasklane 运行时](https://github.com/mapseekai/tasklane)

面向 TypeScript 开发者的 tasklane 中文项目网站。Home 介绍任务与资源模型，Docs 按读者任务组织，Blog 保存六个真实版本的变更记录。导航和 API 名保留英文。

网站使用 [OINK v1.4.0](https://github.com/pgsty/oink/tree/v1.4.0) 官方 [starter](https://github.com/pgsty/oink-starter)，以 Hugo Extended 构建，采用 Hallmark Cobalt 设计系统。运行时源码保持在独立的 tasklane 项目中。

## 本地预览

需要 Hugo Extended 0.168.0 或兼容更新版，以及 Go 1.27.3。当前验证版本为 Hugo 0.169.0。网站构建无需 Node 依赖。

```sh
git clone https://github.com/mapseekai/tasklane-web.git
cd tasklane-web
go mod download
hugo server --renderToMemory --baseURL http://localhost:1314/ --bind 127.0.0.1 --port 1314
```

浏览 [http://localhost:1314/](http://localhost:1314/)。开发环境显式覆盖 baseURL，在本机根路径预览。

## 验证

Node.js 22+ 与 pnpm 11.15.1 用于检查示例。

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
```

检查包含 Hugo 生产构建、所有 HTML 的本地链接与锚点、浏览器示例类型检查，以及 Node.js 真实 Worker 的结果和资源释放断言。构建结果在 `public/`，内存预览不会覆盖它。

```sh
python3 scripts/check-site.py --self-test
```

浏览器交互验收采用 ego-browser，在独立任务空间检查桌面、手机、中文搜索、深色模式和 Mermaid。检查范围与证据见 [验证报告](docs/VERIFICATION.md)，截图保存在该文件列出的本地位置。

## 内容地图

| 路径 | 读者任务 | 类型 |
| --- | --- | --- |
| `content/docs/start/` | 安装并运行首个任务 | 教程与安装指南 |
| `content/docs/concepts/` | 理解预算、所有权和生命周期 | 解释 |
| `content/docs/guides/` | 完成异步准备、取消、分块与状态管理 | 操作指南 |
| `content/docs/reference/` | 查询签名、字段、默认值与错误码 | 参考 |
| `content/docs/architecture/` | 评估运行时和网站的设计边界 | 解释 |
| `content/blog/releases/` | 了解历史变化与兼容性 | 版本记录 |

每页使用 `title`、`description`、`weight` 与 `doc_type`。页面通过 OINK 按 section 和 weight 生成导航。避免把操作步骤、参数字典与原理说明合并成一个长页面。原始变更记录保留原文，中文摘要帮助阅读。

维护者可查阅[内容模型](docs/CONTENT-MODEL.md)和[验证报告](docs/VERIFICATION.md)。

## 源码与示例同步

`data/upstream.json` 固定文档对应的 tasklane 版本、commit 与协议。正文的来源链接指向该快照，API 类型块位于 `assets/reference/`。这些类型块来自源码，不是单独维护的接口实现。

教程从 `examples/` 经 shortcode 读取代码，类型检查与页面使用同一份文件。升级文档时先核对 package、types、Runtime 默认值和协议，再更新概念、指南和 Blog。`pnpm check` 的通过不代表重新跑过运行时仓库的全部浏览器或压力测试。

## 网站架构

`hugo.yaml` 配置站点与固定主题模块。OINK 提供阅读布局、全文搜索、TOC、代码高亮、Mermaid 和 Markdown/RSS 输出。`layouts/index.html` 和 `layouts/_partials/tasklane/` 实现首页；`layouts/_partials/hooks/head-end.html` 加载项目 CSS；其余阅读页面使用主题实现。

颜色、字体、间距通过 `assets/css/tokens.css` 与 `assets/css/site.css` 的主题块统一声明。浅色与深色使用同一语义角色。字体和搜索脚本本地提供；文档在 JavaScript 关闭时仍有正文与普通链接，搜索和图表增强需要 JavaScript。

文档分类使用 find-skills 搜索到的 documentation-writer 和 developer-docs-structure-audit 方法，写作遵循 technical-writing 的源码依据、单一事实来源与明确边界。下载的三个 skills 位于 `.agents/skills/`，包含所需的引用文件。CLI 克隆超时后使用 GitHub 文件接口下载，来源记录在 `data/upstream.json`。它们从下一轮项目会话可发现。

## 发布

站点通过 GitHub Pages 发布到 [mapseekai.github.io/tasklane-web](https://mapseekai.github.io/tasklane-web/)。main 分支的推送会执行构建、链接、元数据和示例检查，通过后上传 Pages 制品并部署。Pull request 只运行检查。

本地检查同一份生产配置：

```sh
pnpm check
```

生产 baseURL 固定在 hugo.yaml。检查器从首页 canonical URL 识别发布子路径，同时检查相对链接和同站点绝对链接。目录中意外指向域名根部的链接会报告错误。

部署状态可在 [Actions](https://github.com/mapseekai/tasklane-web/actions/workflows/verify.yml) 查看。需要恢复旧版时，回退引入问题的源码提交并推送 main，由同一工作流重新构建和部署。无需把 public 产物提交到 Git。

`public/`、缓存、依赖目录与本地验证截图均被 Git 忽略。自定义域名尚未配置。

Hugo 0.169.0 构建时会输出 OINK 所用 LibSass 的弃用警告，当前构建可用。后续 Hugo 若移除 LibSass，需要先核对 OINK 的兼容版本。

## 许可

站点源码保留 starter 的 MIT 许可。OINK 模块为 Apache-2.0，tasklane 为 MIT。第三方主题和 skill 保留其各自的来源及许可信息，见 `NOTICE.md`。
