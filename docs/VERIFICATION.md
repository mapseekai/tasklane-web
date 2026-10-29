# 本地验证

> 本页记录首次发布前的本地验收。当前公开地址为 https://mapseekai.github.io/tasklane-web/，线上部署状态以仓库 Actions 记录为准。

2026-10-29，在 macOS arm64 上验证 tasklane-web。使用 Hugo 0.169.0 Extended、Go 1.27.3、Node.js 22.23.1 与 pnpm 11.15.1。运行时版本固定为 0.2.0-beta.2，来源记录在 data/upstream.json。

## 构建与示例

| 检查 | 结果 | 覆盖 |
| --- | --- | --- |
| pnpm check | 通过 | Hugo 生产构建、链接与元数据、示例 |
| python3 scripts/check-site.py --self-test | 通过 | 合法页面、缺失链接与锚点、文档元数据 |
| 本地链接检查 | 57 个 HTML，3,744 处本地引用，无错误 | 页面、锚点和静态资源；识别跳转页与聚合打印页 |
| TypeScript | 通过 | 浏览器调用端、共享任务目录和 Worker 示例 |
| Node.js 真实 Worker | 通过 | Float64Array 到 Float32Array、结果、Scope、Worker 释放断言 |
| API 表覆盖核对 | 无遗漏 | RuntimeOptions、PoolOptions、AdaptivePoolOptions、TaskOptions、PreparedTaskOptions、SessionOptions、SessionAdmissionOptions，以及 16 个错误码 |
| git diff --check | 通过 | 跟踪文件的空白错误 |
| CLAUDE.md 链接 | 通过 | 相对目标 AGENTS.md、可读性、独立临时 Git index 中 mode 120000 |

原 tasklane 仓库保持建设网站前的状态，只含原有未跟踪 AGENTS.md，没有运行时源码修改。

## 浏览器验证

执行器为用户指定的 ego-browser，使用本任务独立空间 35。检查了 320、375、768、1280、1440 和 1920 CSS 像素宽度。另使用 375 像素 mobile emulation 捕获完整长页。

- 首页首屏在 1280×800 内显示标题、说明、主操作和任务链路。
- 宽屏容器保持 1320px 上限，手机布局没有页面横向溢出。
- 手机主导航、搜索、菜单和主页入口的最终点击区域为 44×44px。
- 实际键盘 Tab 导航触发 :focus-visible，焦点线为 2px solid。
- 中文搜索“背压”返回结果背压页面，并可打开该页面。
- 外观 radio 可切换深色模式。抽查正文、导航、说明和主按钮的浅深色文字对比度，最低为 5.05:1；这不是完整 WCAG 审计。
- 六个 Mermaid 图分别在运行时架构、任务时序、资源边界、网站架构、Scope 生命周期与结果背压页面渲染。
- Blog 列表包含首个 beta 到 0.2.0-beta.2 的六个版本记录；RSS 与 Markdown 输出返回 200，并包含对应内容。
- 手机 API 表格使用 OINK 的局部横向滚动容器，没有撑宽整个页面。

## 设计复核

Hallmark sloplint 对项目 site.css 的静态检查结果为 0 FAIL、0 REFLEX、0 WARN。其 Puppeteer render tier 在本环境未运行；实际浏览器执行和截图使用 ego-browser。模板 HTML 的检查器无法直接关联 Hugo hook 中加载的样式，因此模板级焦点和布局通过实际 DOM 与浏览器检查确认。

独立设计复核结论为 ship：4 项已解决、0 项部分解决、0 项未解决。修复了 graphite 代码块标点对比度、文字链接的重复箭头、泛化章节标题和 Cobalt 控件/面板材质，并按原尺寸重新截图评分。

浏览器复核确认代码标点与代码正文都使用 color-code-ink。主要按钮使用主题的 key-edge tokens，面板使用支持条件下的对角切角。深色模式移除按钮阴影。没有图片素材槽位或待替换的虚构证明。

## 本地截图

截图保留在本地任务制品目录，未随源码仓库发布。

- tasklane-home.png、tasklane-home-1440.png、tasklane-home-1920.png：首页首屏
- tasklane-home-full-1440.png：1440px viewport 完整长页，原生桌面滚动条使 PNG 内容宽度为 1425px
- tasklane-home-full-375.png：375px mobile emulation 完整长页
- tasklane-mobile.png、tasklane-docs-mobile.png、tasklane-reference-mobile.png：手机布局
- tasklane-docs.png、tasklane-blog.png、tasklane-architecture.png、tasklane-dark.png：阅读、Blog、图表与深色布局

## 未覆盖与已知限制

首次本地验收时尚未部署、推送或验证线上域名，GitHub Actions 尚未在远端运行。外部链接未批量联网巡检，未做屏幕阅读器人工审计、真实手机、Firefox、WebKit 或长期运行时压力测试。浏览器示例进行了类型检查，未执行浏览器中的计算任务。

Hugo 0.169.0 构建成功，但 OINK 所用 LibSass 输出弃用警告。未来升级 Hugo 需要先核对主题兼容性。Ego Lite 提示可更新，本次未升级浏览器。
