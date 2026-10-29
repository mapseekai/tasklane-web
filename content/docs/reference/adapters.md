---
title: "平台适配器"
linkTitle: "平台适配器"
description: "查询浏览器、Node 与测试端点的连接方式。"
weight: 60
doc_type: reference
---

Runtime 通过 WorkerEndpoint 管理传输、失败和物理终止。一个 endpoint 必须对应一个新的专用 Worker，Runtime 拥有它的终止权。

| 入口与函数 | 默认行为 | 用途 |
| --- | --- | --- |
| 主入口 `browserWorker(url, options?)` | module Worker | 返回浏览器 Worker 工厂 |
| host 入口 `browserHost(self)` | 监听 message | 包装 Worker 全局消息接口 |
| node 入口 `nodeWorker(url, options?)` | Node WorkerOptions | 返回 worker_threads 工厂 |
| node 入口 `nodeEndpoint(worker)` | 监听消息、error、exit | 包装已有专用 Node Worker |
| node 入口 `nodeHost()` | 使用 parentPort | Worker 内连接 Host，主线程调用会失败 |
| testing 入口 `createLoopback()` | structuredClone 与 transfer | 同线程契约测试 |

## 自定义 endpoint

`postMessage(message, transfer?)` 发送数据；`onMessage(listener)` 和 `onFailure(listener)` 返回取消监听函数；`terminate()` 必须仅在物理终止完成后兑现。

自定义端点还需遵守 Packet 编码、Worker 协议 v7、progress ACK、Scope release ACK 和缓存控制。不要把同一 Worker 交给多个 Runtime 或任务系统共享。

## 源码与契约

- [src/adapters/browser.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/browser.ts)
- [src/adapters/node.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/node.ts)
- [src/testing.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/testing.ts)
- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
