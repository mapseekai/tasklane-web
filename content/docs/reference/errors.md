---
title: "错误码"
linkTitle: "错误码"
description: "用稳定 code 区分运行时失败与远端业务异常。"
weight: 70
doc_type: reference
---

`RuntimeError.code` 是稳定契约，message 用于诊断。不要使用 message 的完整文本判断业务分支。

| code | 含义 | 处理入口 |
| --- | --- | --- |
| `ABORTED` | 任务被中止 | 检查 signal 和取消原因 |
| `CLOSED` | 资源已关闭 | 重新建立有效 Scope 或 Runtime |
| `QUEUE_FULL` | 等待队列达到上限 | 减小生产窗口或等待消费 |
| `QUEUE_TIMEOUT` | 首次准入等待超时 | 查看容量和预算阻塞 |
| `EXECUTION_TIMEOUT` | 准入后执行超时 | 检查准备和算法的物理完成 |
| `STARTUP_TIMEOUT` | Worker 握手超时 | 检查入口加载和 Worker 初始化 |
| `WORKER_FAILED` | 物理 Worker 失败 | 读取故障并重建业务状态 |
| `PROTOCOL_ERROR` | 协议或阶段不符合契约 | 核对主线程和 Worker 版本 |
| `UNKNOWN_TASK` | 目标端未注册该任务 | 检查 handler 名与任务目录 |
| `BUDGET_EXCEEDED` | 数据或资源超出声明上限 | 核对 Packet、blobLimits 和额度 |
| `INVALID_ARGUMENT` | 参数不符合约束 | 检查类型、整数和边界 |
| `SESSION_LOST` | Session 的 Worker 已丢失 | 由应用重建 Session 状态 |
| `HARD_CANCEL_DENIED` | 未允许显式硬取消 | 检查 Pool allowHardCancel |
| `RESULT_RELEASED` | 访问已释放结果 | 在租约有效期内消费 |
| `REMOTE_ERROR` | Worker 业务处理失败 | 读取 remoteError 并按业务规则处理 |
| `CAPACITY_UNAVAILABLE` | Session 无法取得所需容量 | 读取 SessionAdmissionError.reasons |

## remoteError

远端业务异常通过 `REMOTE_ERROR` 传递，`remoteError` 保留 name、可选字符串 code、message，以及受限 stack/details。name/code 上限 128 字符，message 上限 1024，stack 上限 4096。

details 接受有限数字、字符串、布尔值、null、普通对象与数组，限制为 8 层、128 次计费访问和 4 KiB。截断或省略分别由 `truncated` 与 `detailsOmitted` 标记。应用需要时自行重建业务错误类型。

## 释放错误

清理失败会传递给 Scope、Session、迭代器或维护操作的调用方。继续处理前确认实际资源归属，避免仅凭逻辑任务状态假设已归还物理容量。

## 源码与契约

- [src/errors.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/errors.ts)
- [src/remote-error.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/remote-error.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
