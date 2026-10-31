---
title: "数据所有权"
linkTitle: "数据所有权"
description: "理解跨线程传递大数组时“默认复制”与“显式零拷贝转移（Transferable）”的区别，以及为什么切片视图按完整底层缓冲区计费。"
weight: 40
doc_type: explanation
---

当主线程和 Worker 之间传递数据时，浏览器和 Node.js 底层有两种搬运方式：

1. **结构化克隆（默认，相当于复印一份）**：发送方手里的数据还在，接收方拿到一份全新的拷贝。传小对象很方便，但如果传一个 `32 MiB` 的坐标数组，不仅拷贝耗时，还会瞬间占用双倍内存（`64 MiB`）。
2. **所有权转移（`Transferable`，相当于把原件直接递过去）**：瞬间完成零拷贝移交，内存不翻倍。但移交之后，发送方手里的原数组会被立刻“掏空”（变为 `detached`，字节长度变成 `0`），不能再读写。

因为“掏空原数组”是一个具有破坏性的动作，**`tasklane` 绝对不会在背后偷偷转移你的数组所有权**——你是想复印一份，还是想零拷贝移交原件，完全由你在代码里显式指定。

## 怎样显式开启零拷贝转移？

如果你只把 `Float64Array` 放在 `payload` 里而不传 `transfer`，就会走默认的复制模式。想要零拷贝移交，只需在发送时多传一个列表：

- **主线程发给 Worker 时（在 `prepare` 中使用 `transferBuffers`）**：

  ```ts
  prepare() {
    const input = new Float64Array([1, 2, 3]);
    // 显式声明把 input 底层的 ArrayBuffer 移交给 Worker
    return { payload: input, transfer: transferBuffers(input) };
  }
  ```

- **Worker 返回结果给主线程时（使用 `output` 的第二个参数）**：

  ```ts
  convert(input) {
    const result = Float32Array.from(input);
    // 显式声明把 result.buffer 移交回主线程
    return output(result, [result.buffer]);
  }
  ```

消息一旦发出去，原线程里的 `input.byteLength` 就会变成 `0`。

> **注意：如果任务在发送前被取消了呢？**
> 如果任务还在排队，或者刚跑完 `prepare()` 就因为取消或预算超限被拦了下来，根本没走到 `postMessage` 发送这一步，那么转移就没有发生，原数组依然完好地留在原线程。

## 为什么传一个“小切片视图”，也会按整块底层内存计费？

这是很多 JavaScript 开发者处理二进制数据时最容易踩的坑：

假设你先创建了一个 `64 MiB` 的大 `Float64Array`，然后用 `.subarray(0, 10)` 取了前 10 个数字（只有 `80` 字节的一个小视图）传给 Worker。你可能会以为这次传输只占 `80` 字节，但实际上：

1. **平台的物理限制**：`TypedArray` 只是一个指向底层 `ArrayBuffer`（称为 backing store）的“放大镜”。浏览器和 Node.js 的 `postMessage` 在克隆或转移时，搬运的永远是它背后的**整块 `64 MiB` `ArrayBuffer`**，不可能只搬走那 `80` 字节。
2. **按完整底层 `ArrayBuffer` 计费**：因此，`tasklane` 在核算预算时，只要看到一个 `TypedArray` 或 `DataView`，就会按它背后的**完整 `ArrayBuffer` 大小**计费（同一个包裹里如果有多处引用同一个 `ArrayBuffer`，只会去重算一次）。
3. **`transferBuffers()` 的防误伤检查**：如果你把一个 `64 MiB` 共享大数组上的 `80` 字节小视图（`.subarray()`）传给 `transferBuffers()`，一旦转移成功，主线程上那整块 `64 MiB` 内存就全被清空作废了！为了防止这种灾难性的误操作，**`transferBuffers()` 遇到未完整覆盖底层 `ArrayBuffer` 的局部子切片时，会直接报错 `INVALID_ARGUMENT`**。

**正确做法**：当你想从主线程的大数组里切一小块发给 Worker 时，请用 **`.slice(start, end)`**（它会拷贝生成一个只含这一小块数据的独立新 `ArrayBuffer`），然后再传给 `transferBuffers()`。

## 消费完结果后，内存就一定释放了吗？

当主线程通过 `consumeResult(handle, (value) => { ... })` 消费完结果、走出回调函数时，`tasklane` 会立刻释放 `ResultLease` 租约，并把 `outputBytes` 额度还给账本，让后续任务继续运行。

但请记住：**`tasklane` 归还的是账本额度，而真正的物理内存是由 JavaScript 垃圾回收器（GC）释放的**。如果你在 `consumeResult` 回调里写了一句 `globalList.push(value)`，把每次返回的数组都存进了自己的全局变量里不撒手，那么垃圾回收器永远无法回收它们，你的网页内存照样会越积越多。

如果业务确实需要把消费出来的结果长期留在内存里（比如作为图层驻留缓存），请通过 `scope.resources.acquire({ kind: 'resident', bytes })` 向 `residentBytes` 账本正式申请一块常驻额度，做到“谁长期持有、谁登记入账”。

## 源码与契约

- [src/binary.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/binary.ts)
- [src/packet.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/packet.ts)
- [src/resources/lease.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/lease.ts)
