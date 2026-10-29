---
title: "指标与故障诊断"
linkTitle: "指标与故障诊断"
description: "从阻塞原因定位租约、准备、容量或协议问题。"
weight: 60
doc_type: how-to
---

先读取 `runtime.stats` 和 `runtime.diagnostics()`，确定等待来自资源还是 Worker。诊断数据表示 Runtime 管理的状态，实际进程内存需要外部测量。

| 现象 | 优先检查 | 处理方向 |
| --- | --- | --- |
| 队列持续增长 | `leases`、`reserved.outputBytes` | 检查 `consumeResult` 和有限提交窗口 |
| 任务一直在准备 | `preparing`、`prepared`、`resourceDiagnostics()` | 检查准备函数退出与 signal |
| Session 准入失败 | `SessionAdmissionError.reasons` | 检查独占会话、全局容量和 resident |
| Worker 启动失败 | Worker URL、启动超时、`PROTOCOL_ERROR` | 检查构建地址与主/Worker 版本 |
| 关闭后容量未归还 | `quarantinedWorkers`、维护失败 | 处理物理终止失败并重试 |

## 处理错误

用 `RuntimeError.code` 分支，消息用于诊断。业务异常位于 `remoteError`，其中可能保留原始 name、code、message、stack 和受限 details。

```ts
try {
  await consumeResult(handle, consume);
} catch (error) {
  if (error instanceof RuntimeError) {
    console.error(error.code, error.remoteError?.message ?? error.message);
  }
  throw error;
}
```

## 读取计时

`handle.timing` 区分 queue、startup、prepare、roundTrip、worker 和 total 时间。比较同一工作负载与环境，避免把单次结果写成通用吞吐结论。

诊断回调 `onDiagnostic` 的异常与任务执行隔离。记录诊断时，应避免把业务数据或访问凭据直接写入日志。完整错误码见[错误参考](/docs/reference/errors/)。

## 源码与契约

- [src/types.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/types.ts)
- [src/errors.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/errors.ts)
- [src/remote-error.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/remote-error.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
