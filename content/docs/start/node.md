---
title: "第一个 Node.js 任务"
linkTitle: "第一个 Node.js 任务"
description: "用两个文件提交数组，让 Worker 计算，再取回结果。"
weight: 20
doc_type: tutorial
---

这个例子让后台线程把 `new Float64Array([1, 2, 3])` 转为 `Float32Array`。主程序提交任务，Worker 执行转换，主程序取回结果并打印。

这里用三个数看清调用过程，不用于性能比较。接入真实业务时，把 `convert` 中的转换代码换成你的计算函数。

## 1. 创建项目

需要 Node.js 22 或更新版本，可用 `node --version` 检查。创建一个空目录并安装包：

```sh
mkdir tasklane-example
cd tasklane-example
npm init -y
npm install @mapseekai/tasklane@0.2.0-beta.2
```

在这个目录中放两个文件：`worker.mjs` 负责计算，`main.mjs` 负责提交任务和使用结果。它们使用 Node.js 原生 ESM，无需编译。

## 2. 编写计算函数

把下面的完整内容保存为 `worker.mjs`。`convert` 是你的业务函数，运行在 Worker 线程中。

`serve` 将它注册为名叫 `convert` 的任务，`output` 把结果及其缓冲区交回调用端。

{{< example "node/worker.mjs" "javascript" >}}

## 3. 编写调用端

把下面的内容保存为 `main.mjs`。程序创建一个名为 `compute` 的 Worker 组，上限是两个 Worker；本例只提交一次计算。

`scope.enqueue('convert', ...)` 提交的名字，对应 `worker.mjs` 中的 `convert`。`prepare` 提供输入，`consumeResult` 让你使用返回值。

{{< example "node/main.mjs" "javascript" >}}

## 4. 运行并核对输出

在项目目录执行：

```sh
node main.mjs
```

预期输出：

```text
Float32Array: [ 1, 2, 3 ]
```

输入是 64 位浮点数组，输出是 32 位浮点数组，这三个整数的值保持不变。示例还会检查结果类型和清理状态；输出后进程应正常退出。

## 读懂示例中的管理代码

`createWorkerRuntime` 创建任务管理器。它知道 Worker 文件的位置，并复用配置的 Worker 组。`withScope` 把这次业务操作的任务放在一个分组里，回调结束后清理这个分组。

`budget` 声明本任务允许的输入、暂存和输出额度。三个 64 位数占 24 字节，三个 32 位数占 12 字节，因此示例声明 `inputBytes: 24`、`outputBytes: 12`。本例没有通过 scratch 分配暂存空间，声明 `scratchBytes: 0`；计费细节见[资源预算](/docs/concepts/budgets/)。

`consumeResult` 在回调中提供结果，回调结束后释放对应的结果额度。最后的 `runtime.dispose()` 关闭整个任务管理器及其 Worker。代码中的断言用于核对这些清理动作。

在长期运行的应用中，通常保留一个 Runtime，让页面、数据集或业务操作使用各自的 Scope。继续阅读[Runtime 与 Scope](/docs/concepts/lifecycle/)，或把相同的计算接入[浏览器项目](../browser/)。

## 源码与契约

- [src/index.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/index.ts)
- [src/adapters/node.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/node.ts)
- [src/resources/lease.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/lease.ts)
