---
title: "取消与超时"
linkTitle: "取消与超时"
description: "根据算法能力选择协作、丢弃或硬终止。"
weight: 20
doc_type: how-to
---

用 AbortSignal 或 `handle.cancel(reason)` 发起取消。先判断算法是否能让出执行，再选择取消模式。

| 模式 | 物理行为 | 应用条件 |
| --- | --- | --- |
| `cooperative` | 发送取消，等待 handler 检查 signal | 算法可分段并让出事件循环 |
| `discard` | 继续执行并丢弃结果 | 可以接受剩余计算时间 |
| `terminate` | 终止所在 Worker | Pool 允许硬取消，状态可重建 |

## 在循环中响应取消

```ts
async function convert(input, ctx) {
  const result = new Float32Array(input.length);
  for (let start = 0; start < input.length; start += 4096) {
    await ctx.checkpoint();
    const end = Math.min(start + 4096, input.length);
    for (let i = start; i < end; i++) result[i] = input[i];
  }
  return output(result, [result.buffer]);
}
```

`checkpoint()` 让出真实事件循环以接收消息。仅 `await Promise.resolve()` 不能提供相同的取消消息处理机会。

## 配置超时

`queueTimeoutMs` 限制首次准入前等待。`executionTimeoutMs` 覆盖准入后的启动、准备和执行。已发送任务执行超时会触发物理终止，以兑现执行期限。

需要确认 CPU 和额度已经释放时等待 `settled`。硬取消、崩溃和异常终止可能跳过业务资源的正常 disposer，外部事务需要恢复机制。

## 源码与契约

- [src/host.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/host.ts)
- [src/yield.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/yield.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
