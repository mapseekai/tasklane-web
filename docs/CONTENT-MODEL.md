# 内容模型

文档面向 JavaScript / TypeScript 开发者，不预设读者已经了解 Worker 调度或资源管理。阅读顺序是先明确用途和适用场景，再运行一次任务，随后按实际问题查阅概念、指南和接口。

## 内容归属

| 内容位置 | 文档性质 | 读者目的 | 边界 |
| --- | --- | --- | --- |
| docs 首页 | 描述性解释 | 识别用途、运行位置与接入边界 | 先讲应用问题和角色，接口细节由参考页负责 |
| start/node | 教程 | 完成一个可运行的例子 | 单一路径，包含可观察输出 |
| start/installation、start/browser | 操作指南 | 在目标环境接入 | 明确环境前提和构建差异 |
| concepts | 描述性解释 | 理解生命周期与资源归属 | 解释当前机制，不混入升级历史 |
| guides | 操作指南 | 解决准备、取消、文件和状态问题 | 上下文代码明确标注调用方责任 |
| reference | 接口参考 | 查询完整字段和默认值 | 声明和代码依据优先于摘要 |
| architecture | 描述性解释 | 评估运行链路与设计代价 | 图示对应真实模块，概念分层不暗示独立服务 |
| blog/releases | 历史记录 | 核对版本变化 | 原始 Changelog 保持原文和原日期 |

## 导航与维护

Home、Docs、Blog 构成站点一级导航。文档按 section 与 weight 排序，路径不超过三层内容目录。手机通过 Docs、Blog、返回主页的品牌链接和导航菜单访问站点。

front matter 必须包含 title 与 description，文档和 Blog 还需 doc_type。检查器验证这些字段及所有本地链接和锚点。参数表已针对七组源码接口和全部 16 个错误码逐项核对。

一个事实保留一个负责页面，索引只负责引导。源码版本由 data/upstream.json 固定；类型块由 assets/reference 提供；完整教程使用 examples 中同一份可测试源文件。

## 依据与限制

分类使用 find-skills 搜索到的 documentation-writer 和 developer-docs-structure-audit 方法，写作使用 technical-writing 和 reviewing-technical-prose 的源码依据规则。它们是内容组织方法，不证明用户一定能找到答案。

本次是可读源码与本地站点的桌面审查，未进行卡片分类、读者树测试、搜索分析或 CNCF 评分。结构应在读者反馈出现后据实调整。
