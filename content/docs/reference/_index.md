---
title: "API 参考"
linkTitle: "API 参考"
description: "按公共入口与资源边界查阅签名、字段和默认值。"
weight: 40
doc_type: reference
---

参考页对应当前文档固定的源码快照。字段表解释用途与默认值，类型块保留完整声明。

| 入口 | 使用位置 | 参考页 |
| --- | --- | --- |
| `@mapseekai/tasklane` | 调用线程 | [Runtime](runtime/)、[任务](tasks/)、[资源](resources/)、[数据](data/) |
| `@mapseekai/tasklane/host` | Worker | [Host 与缓存](host/) |
| `@mapseekai/tasklane/node` | Node 调用端与 Worker | [平台适配器](adapters/) |
| `@mapseekai/tasklane/testing` | 测试 | [平台适配器](adapters/) |

[指标结构](diagnostics/)与[错误码](errors/)分别定义观测和失败边界。[文档依据](provenance/)说明版本、源码与验证范围。

## 源码与契约

- [src/index.ts](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/src/index.ts)
- [package.json](https://github.com/mapseekai/tasklane/blob/b40ba606552c4b798ebb803528548151186b364b/package.json)
