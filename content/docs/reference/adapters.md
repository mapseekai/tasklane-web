---
title: "平台适配器"
linkTitle: "平台适配器"
description: "查询浏览器 Web Worker、Node.js worker_threads、同线程测试端点与自定义 WorkerEndpoint 的接口规范。"
weight: 60
doc_type: reference
---

`WorkerRuntime` 通过统一的 `WorkerEndpoint` 接口管理跨线程消息收发、故障监听与物理终止；Worker 内的 `serve()` 则通过 `MessagePortLike` 接口接收请求。

## 内置平台适配器列表

| 导入入口 | 函数签名 | 默认行为 | 适用场景 |
| --- | --- | --- | --- |
| `@mapseekai/tasklane` | `browserWorker(url, options?)` | 默认以 `{ type: 'module' }` 调用 `new Worker(url, options)` | 浏览器主线程配置 `PoolOptions.factory` |
| `@mapseekai/tasklane/host` | `browserHost(scope?)` | 默认绑定 `globalThis.self` 的 `message` 事件与 `postMessage` | 浏览器 Web Worker 脚本内传给 `serve()` |
| `@mapseekai/tasklane/node` | `nodeWorker(url, options?)` | 返回每次调用新建 `worker_threads.Worker` 的工厂函数 | Node.js 主线程配置 `PoolOptions.factory` |
| `@mapseekai/tasklane/node` | `nodeEndpoint(worker)` | 将已创建的专用 `worker_threads.Worker` 实例包装为 `WorkerEndpoint` | 需要在外部自定义构造 Node Worker 实例时使用 |
| `@mapseekai/tasklane/node` | `nodeHost()` | 获取 `worker_threads.parentPort` 并包装为 `MessagePortLike`（在主线程调用会抛 `PROTOCOL_ERROR`） | Node.js Worker 脚本内传给 `serve()` |
| `@mapseekai/tasklane/testing` | `createLoopback()` | 返回 `{ endpoint, host, fail(error) }`，在同线程内通过 `structuredClone` 与 `transfer` 传递消息 | 单元测试与故障注入测试 |

## 自定义 `WorkerEndpoint` 契约

如果你需要将 `tasklane` 桥接到自定义的传输通道，实现的 `WorkerEndpoint` 必须满足以下四项方法契约：

- **`postMessage(message: unknown, transfer?: readonly Transferable[]): void`**：发送协议消息并转移指定的 `ArrayBuffer`。
- **`onMessage(listener: (message: unknown) => void): () => void`**：注册消息接收回调，并返回取消订阅函数。
- **`onFailure(listener: (error: unknown) => void): () => void`**：当底层 Worker 发生未捕获错误或意外退出（如 Node Worker 非零退出码）时触发，并返回取消订阅函数。
- **`terminate(): void | Promise<void>`**：物理终止该 Worker。**关键约束**：返回的 Promise 必须在底层线程**真正完成终止后**才能兑现；若终止失败则应当拒绝，以便 Runtime 将该槽位标记为 `quarantinedWorkers` 并保留其容量占用。

此外，每个 `WorkerEndpoint` 必须对应一个由当前 `Runtime` **独占拥有终止权**的专用执行环境，切勿将同一个物理 Worker 实例同时交给多个 `Runtime` 或其他消息库混用。

## 源码与契约

- [src/adapters/browser.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/browser.ts)
- [src/adapters/node.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/node.ts)
- [src/testing.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/testing.ts)
- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
