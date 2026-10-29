---
title: "使用指南"
linkTitle: "使用指南"
description: "围绕真实集成任务组织操作步骤。"
weight: 30
doc_type: how-to
---

先运行[入门示例](/docs/start/)，再按项目中遇到的问题选择指南。每份指南说明调用代码和 Worker 处理函数分别需要完成的工作。

- [异步输入准备](preparation/)：在取得额度后读取或组装输入。
- [取消与超时](cancellation/)：为取消按钮、页面切换和超时选择处理方式。
- [文件与分块](files/)：分块读取或处理大文件，按配置管理数据额度。
- [状态型计算](sessions/)：复用同一 Worker 中的实例或数据句柄，并在结束时清理。
- [资源调度与内存压力](resource-scheduling/)：配置预留、缩容与回收。
- [指标与故障诊断](diagnostics/)：定位预算、租约和 Worker 问题。
- [测试与验证](testing/)：为应用集成建立可重复的检查。
