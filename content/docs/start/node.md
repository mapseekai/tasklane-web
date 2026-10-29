---
title: "第一个 Node.js 任务"
linkTitle: "第一个 Node.js 任务"
description: "运行数组转换任务，验证结果并确定性释放 Worker。"
weight: 20
doc_type: tutorial
---

这个例子将 `Float64Array` 转为 `Float32Array`。输入在取得额度后创建，结果在消费后释放，Runtime 在结束时关闭。

## 创建项目

```sh
mkdir tasklane-example
cd tasklane-example
npm init -y
npm install @mapseekai/tasklane@0.2.0-beta.2
```

新建两个 `.mjs` 文件。它们使用 Node.js 原生 ESM，无需编译。

## 编写 Worker

保存为 `worker.mjs`。`serve` 注册处理函数，`output` 明确转移结果缓冲区。

{{< example "node/worker.mjs" "javascript" >}}

## 提交并消费任务

保存为 `main.mjs`。示例输入是根 TypedArray，因此输入预算是 3 × 8 字节，输出预算是 3 × 4 字节。复合对象的预算还需要包含元数据。

{{< example "node/main.mjs" "javascript" >}}

## 运行并确认

```sh
node main.mjs
```

预期输出：

```text
Float32Array: [ 1, 2, 3 ]
```

示例内的断言同时检查转换结果、结果租约、Scope 和 Worker 的释放。输出后进程应正常退出。

## 源码与契约

- [src/index.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/index.ts)
- [src/adapters/node.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/adapters/node.ts)
- [src/resources/lease.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/resources/lease.ts)
