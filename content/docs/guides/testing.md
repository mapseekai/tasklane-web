---
title: "测试与验证"
linkTitle: "测试与验证"
description: "覆盖数据正确性、所有权与确定性清理。"
weight: 70
doc_type: how-to
---

应用测试应同时检查业务输出与资源归还。tasklane 的 `createLoopback()` 适合同线程契约测试，真实 Worker 测试用于确认线程和平台行为。

## 最小回归范围

验证成功路径、消费者抛错、取消、错误和关闭。二进制任务额外检查 transfer 后的所有权、完整 backing store 计费和超额拒绝。Session 测试应包含正常 disposer 与失败重试。

`createLoopback` 保留 structuredClone 与 transfer 语义，但它不能证明真实线程隔离、浏览器调度或设备性能。至少用目标平台的 Worker 再运行集成用例。

## 运行时仓库检查

在 tasklane 源码仓库中执行：

```sh
pnpm typecheck
pnpm test
pnpm test:browser
pnpm test:stress
pnpm test:package
```

浏览器检查需要仓库配置所要求的 Chrome、Firefox 和 WebKit。这里列的是运行时项目的命令；文档网站自己的验证命令见[网站架构](/docs/architecture/website/)。

## 性能验证

使用实际算法、数据规模、线程数和消费速度记录结果，并注明环境。协议预算峰值与 RSS 不是同一指标。仓库的[性能方法](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/performance.md)可作为工作负载起点，不能替代应用上线验证。

## 源码与契约

- [src/testing.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/testing.ts)
- [test/contracts.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/test/contracts.ts)
- [docs/testing.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/testing.md)
- [docs/performance.md](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/docs/performance.md)
