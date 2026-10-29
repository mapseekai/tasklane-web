---
title: "快速开始"
linkTitle: "快速开始"
description: "安装并运行一个具备明确资源生命周期的任务。"
weight: 10
doc_type: tutorial
---

先用 Node.js 示例验证提交、执行和结果消费，再将相同的任务目录接入浏览器。

1. [安装与运行环境](installation/)：选择包版本，确认平台要求。
2. [第一个 Node.js 任务](node/)：创建 Worker，转换数组，消费结果并关闭 Runtime。
3. [浏览器接入](browser/)：在既有 TypeScript 构建中接入 module Worker。

完成后阅读[结果背压](/docs/concepts/results/)。它决定什么时候能够继续提交下一块数据。
