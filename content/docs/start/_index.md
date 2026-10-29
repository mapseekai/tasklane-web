---
title: "快速开始"
linkTitle: "快速开始"
description: "提交一份数据，在后台线程计算，再取回结果。"
weight: 10
doc_type: tutorial
---

先运行一个完整的小例子：主程序提交数组 `[1, 2, 3]`，Worker 将它转换为另一种数组类型，主程序拿回结果并打印。你会看到调用代码和计算函数分别放在哪里，以及任务怎样在两者之间传递。

如果还不确定它能解决什么问题，先读[认识 tasklane](/docs/)。

## 选择运行入口

1. [安装与运行环境](installation/)：确认 Node.js 或浏览器所需条件，安装对应版本。
2. [第一个 Node.js 任务](node/)：推荐先运行。只需 Node.js 和两个 `.mjs` 文件，无需配置前端打包器。
3. [浏览器接入](browser/)：在已有 TypeScript 前端项目中配置 Worker 入口，并从页面代码提交相同的任务。

Node.js 示例可以直接执行命令核对输出。浏览器页面是已有项目的集成步骤，需要项目的构建工具处理 npm 导入和 Worker 产物。

## 跑通后的阅读顺序

先用[Runtime 与 Scope](/docs/concepts/lifecycle/)理解示例里的任务管理器和业务分组。持续处理多块数据时，再看[结果背压](/docs/concepts/results/)，了解如何让后续任务等待结果被消费，避免一直积累待处理结果。

需要接入文件、取消操作或长期保存状态时，选择对应的[使用指南](/docs/guides/)。
