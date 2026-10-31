---
title: "第一个 Node.js 任务"
linkTitle: "第一个 Node.js 任务"
description: "只需两个 .mjs 文件，亲手跑通从提交数组、Worker 后台转换到释放资源的完整流程。"
weight: 20
doc_type: tutorial
---

在本篇教程中，我们将用两个简短的文件完成一次完整的后台计算：

1. **主程序（`main.mjs`）** 准备一个 64 位浮点数组 `Float64Array([1, 2, 3])` 交给后台；
2. **后台线程（`worker.mjs`）** 将它转换成 32 位浮点数组 `Float32Array` 并传回；
3. **主程序** 打印转换结果，并在最后确认所有内存租约和后台线程都已清理干净。

为了让你一眼看清数据是如何流转的，这里只传了 3 个数字。在实际项目中，你只需要把转换逻辑换成你自己的文件解析或坐标计算代码即可。

## 第 1 步：创建目录并安装包

请确认本机已安装 Node.js 22 或更高版本（可运行 `node --version` 查看）。打开终端，创建一个空文件夹并安装 `@mapseekai/tasklane`：

```sh
mkdir tasklane-demo
cd tasklane-demo
npm init -y
npm install @mapseekai/tasklane@0.2.0-beta.2
```

接下来我们直接编写原生 ES Module 文件（`.mjs`），无需配置 TypeScript 或打包工具。

## 第 2 步：编写 Worker 计算函数（`worker.mjs`）

在 `tasklane-demo` 目录下新建 `worker.mjs`，粘贴以下代码：

{{< example "node/worker.mjs" "javascript" >}}

这段代码非常直观：
- `nodeHost()` 拿到当前 Node.js Worker 线程的通信通道；
- `serve(...)` 把一个名叫 `convert` 的函数注册为后台任务；
- 当 `convert(input)` 被调用时，它把收到的 `Float64Array` 转成 `Float32Array`，然后用 `output(result, [result.buffer])` 把结果连同底层内存（`ArrayBuffer`）的所有权一起零拷贝移交回主线程。

## 第 3 步：编写主程序调用代码（`main.mjs`）

在同一个目录下新建 `main.mjs`，粘贴以下代码：

{{< example "node/main.mjs" "javascript" >}}

## 第 4 步：运行并查看结果

在终端运行：

```sh
node main.mjs
```

你会立即看到终端打印出转换后的数组，随后进程干净退出：

```text
Float32Array: [ 1, 2, 3 ]
```

恭喜！你已经跑通了第一个 `tasklane` 后台任务。

## 第 5 步：花 1 分钟看懂 `main.mjs` 里的四个关键设计

回头看刚刚运行的 `main.mjs`，你可能会好奇：为什么要写 `withScope`、`budget`、`prepare` 和 `consumeResult`？它们各自解决了一个在真实项目里极易踩坑的问题：

1. **`createWorkerRuntime`（管线程池）**：
   创建一个名为 `compute`、最多允许 2 个 Worker 的池。注意：**Worker 是按需懒加载的**——创建 `Runtime` 时并不会立刻拉起线程，只有当任务真正开始执行时才会启动。
2. **`runtime.withScope('example', ...)`（管业务分组）**：
   把这次操作放进一个名叫 `'example'` 的作用域（`Scope`）里。一旦大括号里的代码执行完毕（或者中途抛错），这个 `Scope` 会自动销毁并清理它留下的所有资源。
3. **`budget` 与 `prepare()`（管输入内存与零拷贝）**：
   - **为什么要填 `budget`？** 3 个 64 位浮点数占 `3 × 8 = 24` 字节，转成 3 个 32 位浮点数占 `3 × 4 = 12` 字节，因此声明 `inputBytes: 24, scratchBytes: 0, outputBytes: 12`。在真实大数据场景下，`tasklane` 靠这个预算账本来确保同时跑的任务不会把内存撑爆。
   - **为什么 `prepare` 是个函数，而不是直接传 `payload: new Float64Array(...)`？** 假设你一口气提交了 500 个任务，如果入队时就立刻 `new` 出 500 个大数组，内存当场就爆了。把构造逻辑放进 `prepare()` 函数里，**只有当这个任务真正排到空闲 Worker 且内存额度够用时，`tasklane` 才会调用 `prepare()` 生成数据**。同时，`transferBuffers(input)` 会把这块内存的所有权直接移交给 Worker，省去复制开销。
4. **`consumeResult(task, ...)`（管结果消费与背压）**：
   Worker 算完返回后，那 `12` 字节的输出额度依然被锁着。当你用 `consumeResult` 读完结果、走出回调函数时，它会自动释放结果租约（`ResultLease`）并归还那 `12` 字节额度，让后面排队的任务得以继续执行。

> **在真实应用里怎么用？**
> 上面的演示脚本在最后调用了 `await runtime.dispose()` 关闭整个线程池以便退出进程。在真实的 Web 页面或后端服务中，你通常在**应用启动时创建一个全局 `Runtime` 长期复用**，而在每次打开地图、切换数据集或处理文件时创建各自的 `Scope`。

下一步，你可以看看如何把这段代码[集成到浏览器前端项目](../browser/)、查阅在后端服务中的[Node.js 生产实践](/tasklane-web/docs/guides/nodejs-production/)，或者阅读[核心概念](/tasklane-web/docs/concepts/)了解更多细节。

## 源码与契约

- [src/index.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/index.ts)
- [src/adapters/node.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/node.ts)
- [src/resources/lease.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/lease.ts)
