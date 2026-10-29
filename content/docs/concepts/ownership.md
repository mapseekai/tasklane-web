---
title: "数据所有权"
linkTitle: "数据所有权"
description: "为跨线程二进制数据明确复制和转移的责任。"
weight: 40
doc_type: explanation
---

tasklane 只转移显式列出的对象。把 TypedArray 放入 payload 不会自动转移其缓冲区；需要所有权转移时，使用 `transferBuffers` 或显式 transfer list。

```ts
const input = new Float64Array([1, 2, 3]);
return { payload: input, transfer: transferBuffers(input) };
```

发送成功后，原 ArrayBuffer 及其别名会被 detach。发送前取消时可能根本没有发生转移，调用方不能仅凭逻辑取消推断缓冲区状态。

## 完整 backing store

根二进制视图按完整 backing store 计费。把大缓冲区的一个小视图传入任务，仍可能需要大缓冲区的额度。`transferBuffers` 接受可表达完整所有权的 buffer 或完整视图，并去重 backing store。

共享同一个缓冲区的多个视图属于同一所有权单元。需要保留原数据时，先创建任务自有副本，再决定是否转移。`transferOwnedBuffers` 是表达相同转移语义的别名。

## 结果引用

`ResultLease.release()` 归还输出额度并清除租约持有的引用。消费者另存的对象或缓冲区仍由消费者管理，Runtime 无法撤销这些引用。逐块消费并避免积累已释放租约的值，才能维持应用的内存边界。

## 源码与契约

- [src/binary.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/binary.ts)
- [src/packet.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/packet.ts)
- [src/resources/lease.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/lease.ts)
