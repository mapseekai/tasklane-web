---
title: "使用指南"
linkTitle: "使用指南"
description: "按真实开发场景组织的实战指南：异步准备输入、取消任务、大文件分块读取、保持 Worker 状态、应对内存压力、排查故障与编写测试。"
weight: 30
doc_type: how-to
---

跑通[快速开始](/docs/start/)后，你在把 `tasklane` 集成进真实项目时，往往会遇到下面这些具体问题。

每一篇指南都直接给出了**“什么时候用 + 主线程怎么写 + Worker 怎么写 + 常见踩坑提醒”**，你可以按手头正在做的需求直接点进去查阅：

- **[异步输入准备](preparation/)**：发给 Worker 的数据需要先从 `Blob.arrayBuffer()`、IndexedDB 或网络异步读取，怎么在不白白占着 Worker 线程的前提下控制异步读取并发？
- **[取消与超时](cancellation/)**：用户拖走了地图视口或点了“取消”按钮，怎么停掉正在跑的任务？在长循环里怎么用 `await ctx.checkpoint()` 及时响应取消？
- **[文件与分块](files/)**：怎么把几百兆的 `File` / `Blob` 传进 Worker，并用 `iterateResults` 像拧水龙头一样“消费完一块、再拉取下一块”？
- **[状态型计算](sessions/)**：怎么用 `Session` 和 `ctx.cache.setResource` 在 Worker 里长期持有 SQLite / DuckDB 数据库、GDAL 或 WASM 实例，并在结束时安全关闭？
- **[资源调度与内存压力](resource-scheduling/)**：怎么用 `interactiveReserve` 给交互任务留出专属通道？怎么用 `SessionGroup` 让多个只读副本协同工作？移动端或大图层内存吃紧时怎么动态缩容？
- **[指标与故障诊断](diagnostics/)**：任务一直排队不走、内存额度居高不下或者报了 `RuntimeError`，怎么看一眼 `stats` 和 `diagnostics()` 就抓出病根？
- **[测试与验证](testing/)**：怎么用 `createLoopback()` 在不启动真实线程的情况下飞快跑完单元测试，并验证内存没有泄漏？
