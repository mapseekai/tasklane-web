---
title: "API 参考"
linkTitle: "API 参考"
description: "按四个公共导出子路径查询 tasklane 的函数签名、配置字段、默认值、类型声明与错误码。"
weight: 40
doc_type: reference
---

本节提供与 `tasklane@0.2.0-beta.2`（Worker 协议 `v7`）源码快照严格对应的接口参考。各页以结构化表格说明每个配置项与方法的类型、默认值及契约边界，并附上来自源码的完整 TypeScript 类型声明。

## 公共包入口索引

`@mapseekai/tasklane` 提供四个独立的导出入口，按运行位置与职责隔离依赖：

| 包入口 | 运行位置 | 主要导出符号 | 对应参考页 |
| --- | --- | --- | --- |
| `@mapseekai/tasklane` | 调用线程（浏览器或 Node.js） | `createWorkerRuntime`、`browserWorker`、`consumeResult`、`transferBuffers`、`transferOwnedBuffers`、`packetByteLength`、`binaryByteLength`、`dataByteLength`、`iterateResults`、`iterateSizedResults`、`RuntimeError`、`SessionAdmissionError` | [Runtime 与 Pool 配置](runtime/)、[任务与结果接口](tasks/)、[Scope、Session 与资源](resources/)、[数据计费与消费工具](data/) |
| `@mapseekai/tasklane/host` | Worker 线程 | `serve`、`output`、`browserHost`、`createSizedResultSource` | [Host 与 Worker 缓存](host/)、[数据计费与消费工具](data/) |
| `@mapseekai/tasklane/node` | Node.js 调用端或 Worker 端 | `nodeWorker`、`nodeEndpoint`、`nodeHost` | [平台适配器](adapters/) |
| `@mapseekai/tasklane/testing` | 测试环境 | `createLoopback` | [平台适配器](adapters/) |

## 可观测性、错误与版本依据

- [错误码参考](errors/)：查询 `RuntimeError.code` 的全部 16 个稳定错误码、`remoteError` 截断规则与 `SessionAdmissionError` 拒绝原因。
- [指标与诊断类型](diagnostics/)：查询 `runtime.stats`、`runtime.diagnostics()`、`runtime.resourceDiagnostics()` 与 `TaskTiming` 的字段口径。
- [文档依据与版本](provenance/)：查询本文档站对应的源码 commit、类型快照位置与验证范围说明。

## 源码与契约

- [src/index.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/index.ts)
- [package.json](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/package.json)
