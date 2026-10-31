---
title: "协议与故障隔离"
linkTitle: "协议与故障隔离"
description: "了解主线程与 Worker 之间的协议 v7 消息机制、Worker 代际号（epoch）防串台设计、数组紧凑编码与进度流控。"
weight: 20
doc_type: explanation
---

在主线程的 `WorkerRuntime` 和 Worker 里的 `serve()` 之间，所有的互动都通过一套固定格式的内部协议（当前版本为 **Protocol v7**）完成。

你平时写业务代码不需要直接接触这些底层消息，但理解这套协议的四个核心设计，能帮你明白为什么 `tasklane` 在面对线程重启、超时强杀、超大数组传输和高频进度上报时依然能稳如泰山。

## 1. 七种内部协议消息

主线程和 Worker 之间一共只交换以下 7 对消息：

| 消息名称 | 谁发给谁 | 它负责干什么 |
| --- | --- | --- |
| **`hello` / `ready`** | 双向握手 | Worker 刚启动时核对协议版本是不是 `v7`、记录代际号 `epoch`，并由 Worker 汇报自己注册了哪些任务名 |
| **`request`** | 主线程 ➔ Worker | 把打包好的输入数据（`Packet`）连同允许的最大输出/暂存字节上限一起发给 Worker |
| **`result` / `error` / `cancelled`** | Worker ➔ 主线程 | 汇报任务算完了、报错了还是取消了，同时顺带捎上最新的本地缓存使用量统计 |
| **`progress` / `progress-ack`** | 双向流控 | Worker 上报计算进度，主线程收到后回一个 `progress-ack` 确认 |
| **`cancel`** | 主线程 ➔ Worker | 通知正在跑的任务触发 `ctx.signal` 协作取消 |
| **`release-scope` / `released`** | 双向清理确认 | 主线程销毁 `Scope` 或 `Session` 时，让 Worker 清空对应缓存并跑完异步关闭函数（`disposer`），跑完后回传 `released` |
| **`cache-control` / `cache-controlled`** | 双向容量调节 | 主线程要求 Worker 缩小缓存上限或执行 `trim`，Worker 清理完后回传确认 |

## 2. 为什么每条消息都要带一个代际号（`epoch`）？

设想这样一个惊险的竞态场景：
1. 1 号槽位上的旧 Worker 因为跑某个任务超时了，主线程决定销毁它，并在同一个 1 号槽位上启动了一个全新的 Worker；
2. 就在旧 Worker 被彻底掐断前的最后一微秒，它刚好发出了一条迟到的消息（比如 `result` 或者 `released` 释放确认）；
3. 如果主线程不加分辨地收下了这条迟到消息，就会把旧 Worker 的结果张冠李戴给新任务，或者误以为新 Worker 的资源已经释放了！

为了彻底杜绝这种“前朝的剑斩本朝的官”，`tasklane` 给每一次物理 Worker 的出生都发了一个唯一递增的身份证号——**`epoch`（代际号）**。主线程和 Worker 发出的任何消息都带着当时的 `epoch`。只要槽位换了新 Worker（`epoch` 变了），任何带着旧 `epoch` 姗姗来迟的消息都会被当场识破并直接扔进垃圾桶。

## 3. 协议 v7 是怎么给数组传输“瘦身”的？

在跨线程传输复合数据时，`tasklane` 会把对象图编码成 `Packet`（支持普通对象、数组、`Map`、`Set`、`Date`、`RegExp`、二进制视图、`File`/`Blob` 附件，甚至能完整还原循环引用、稀疏数组空洞、`-0`、`NaN` 和 `BigInt`）。

在 `0.2.0-beta.2` 的 **协议 v7** 中，专门针对普通 JavaScript 数组做了一项大幅瘦身：
- 以前把普通数组当成对象属性编码时，需要存下 `"0"`、`"1"`、`"2"` 这样的下标字符串键；
- 现在协议 v7 对普通数组的**连续元素前缀直接按位置紧凑编码**，省去了所有下标字符串键，接收端解码时直接复用 JSON 解析出的数组原地恢复引用。对于包含几十万个数字的普通数组，这显著降低了元数据体积（因此升级到 `0.2.0-beta.2` 时，请确保主线程和 Worker 一起更新）。

同时，为了防止恶意或错误的超深对象图把序列化过程卡死，单包内置了硬护栏：最多允许 `100,000` 个对象、`1,000,000` 条引用边、`4,096` 个独立 `ArrayBuffer`、`256` 个文件附件和 `64 MiB` 元数据。

## 4. 进度上报（`ctx.progress`）为什么不会淹没主线程？

如果 Worker 在一个一百万次的循环里每轮都调一次 `ctx.progress({ percent })`，瞬间发出的上百万条消息会直接把主线程的事件循环彻底堵死。

因此，`ctx.progress()` 在底层做了三层自动防洪保护，你随便调也不会卡死主线程：
1. **只传轻量状态**：每次进度消息限制在 `4 KiB` 以内（最多 64 个对象）；大体积的预览图或分块数据请走带 `ResultLease` 的任务返回值；
2. **最多 1 条在途 + 16 毫秒节流**：Worker 发出一帧进度后，在收到主线程回传的 `progress-ack` 且满 `16 ms`（约 60 FPS）之前，绝不会再往通道里塞第二条消息；
3. **自动合并最新值**：在这等待的 16 毫秒里，就算你的循环又调了 500 次 `ctx.progress()`，Worker 也只会静默用最新那一次覆盖旧值，等收到 ACK 后只把最新这一帧发出去。

## 源码与契约

- [src/protocol.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/protocol.ts)
- [src/progress.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/progress.ts)
- [src/runtime/runtime.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/runtime/runtime.ts)
- [src/host.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/host.ts)
