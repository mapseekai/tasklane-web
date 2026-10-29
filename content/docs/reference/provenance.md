---
title: "文档依据与版本"
linkTitle: "文档依据与版本"
description: "说明文档源码、历史记录和验证结论的边界。"
weight: 90
doc_type: reference
---

本网站根据 tasklane 源码编写，固定的包版本为 `0.2.0-beta.2`，Worker 协议版本为 `7`。

| 材料 | 固定来源 | 用途 |
| --- | --- | --- |
| 包与公共 API | [tasklane 源码快照](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/package.json) | 版本、入口与 API 契约 |
| 类型与默认值 | [types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)、[runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts) | 配置表和完整类型声明 |
| 生命周期与数据边界 | [资源契约](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/resources.md) | 计费、释放和可信端点边界 |
| 版本博客 | [CHANGELOG.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/CHANGELOG.md) | 保留原记录中的版本、日期与变化 |
| 网站模板 | [OINK v1.4.0](https://github.com/pgsty/oink/tree/v1.4.0) | Hugo 文档阅读框架 |

## 状态的含义

源码中存在某个功能不等于它已在所有环境验证。Blog 的日期来自 Changelog 记录，不单独证明 npm 发布或线上部署状态。本地示例验证与实际业务的浏览器、长期负载和生产验证应分别记录。

文档站的验证结果由维护者记录在本地检查报告中。运行时的历史测试与基准结果属于原始仓库，不作为本次站点建设重新执行过的检查。

## 维护来源

`data/upstream.json` 固定源码快照。API 类型块存放在 `assets/reference/`，教程代码存放在 `examples/`，页面通过 shortcode 引用同一份代码。更新版本时需要同时核对文档、类型快照与版本博客。
