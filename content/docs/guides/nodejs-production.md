---
title: "Node.js 服务端生产实践"
linkTitle: "Node.js 生产实践"
description: "在 Express / Fastify 服务、Docker 容器与生产环境中部署 tasklane，掌握 CPU 配额、请求级 Scope 绑定与优雅退出。"
weight: 85
doc_type: how-to
---

`tasklane` 具备原生同构特性，不仅能运行在浏览器中，还能在 Node.js 服务端通过 `worker_threads` 充当高吞吐、带背压与内存治理的计算引擎。

当你在后端服务（如 Express、Fastify、Nest.js）或微服务容器中引入 `tasklane` 处理大文件转换、报表导出或密集计算时，需要掌握以下生产级工程实践。

---

## 核心生产架构原则

```
┌────────────────────────────────────────────────────────┐
│               Node.js 进程启动 (单例持久)               │
│        createWorkerRuntime({ maxWorkers: 4, ... })     │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│ HTTP 请求 A (客户端发起)│       │ HTTP 请求 B (客户端发起)│
│ req.scope = create... │       │ req.scope = create... │
│ 派生独立请求级作用域   │       │ 派生独立请求级作用域   │
├───────────────────────┤       ├───────────────────────┤
│ 客户端中途断开连接:    │       │ 任务正常执行完毕:      │
│ req.on('close') 触发  │       │ 返回结果给客户端       │
│ req.scope.dispose()   │       │ req.scope.dispose()   │
│ (Worker 计算立刻中断) │       │ (归还预算与槽位)      │
└───────────────────────┘       └───────────────────────┘
```

1. **单例 Runtime**：全局只初始化一个 `WorkerRuntime` 实例，严禁在每个 HTTP 请求处理函数内重复创建。
2. **请求级 Scope 绑定**：每个 HTTP 请求派生一个专属的 `Scope`，并监听请求关闭事件，**当客户端提前断开连接时，立即销毁 Scope**，避免服务器白白进行昂贵的无效运算。
3. **精准评估容器 CPU 配额**：避免在 Docker / Kubernetes 容器中直接使用 `os.cpus().length`，防止盲目创建过多工作线程导致容器被 OOMKilled。

---

## 容器化与 CPU 配额避坑

在 Kubernetes 或 Docker 容器中，如果为 Pod 分配了 `resources.limits.cpu = 2`，此时运行 `os.cpus().length` 依然会返回**物理宿主机的核心数**（例如 32 或 64）。如果直接按 64 创建 Worker 线程，会引发严重的 CPU 时间片争抢与内存暴涨。

**生产级安全获取 CPU 核数方案**：

```typescript
import os from 'node:os';
import fs from 'node:fs';

export function getSafeWorkerCount(defaultCount = 2): number {
  try {
    // 检查 Linux cgroups v2 配额
    if (fs.existsSync('/sys/fs/cgroup/cpu.max')) {
      const content = fs.readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim();
      const [quota, period] = content.split(' ');
      if (quota !== 'max' && period) {
        const cores = Math.floor(Number(quota) / Number(period));
        return Math.max(1, cores);
      }
    }
  } catch {
    // 降级使用系统核数
  }

  const systemCpus = os.cpus().length;
  // 留出 1 个核心给 Node.js 主事件循环与网络 I/O
  return Math.max(1, Math.min(systemCpus - 1, defaultCount));
}
```

---

## 在 Express / Fastify 中集成

### 1. 初始化全局 Runtime 与中间件

```typescript
// src/tasklane.ts
import { createWorkerRuntime } from '@mapseekai/tasklane';
import { nodeWorker } from '@mapseekai/tasklane/node';
import { getSafeWorkerCount } from './utils';

const workerCount = getSafeWorkerCount(4);

export const runtime = createWorkerRuntime({
  pools: {
    heavy: {
      factory: nodeWorker(new URL('./workers/heavy.worker.mjs', import.meta.url)),
      size: workerCount,
    },
  },
  maxWorkers: workerCount,
  budgets: {
    inputBytes: 128 * 1024 * 1024,
    scratchBytes: 256 * 1024 * 1024,
    outputBytes: 128 * 1024 * 1024,
  },
});
```

### 2. 绑定请求生命周期（连接断开自动取消）

在 Express 路由中，通过 `req.on('close')` 实现级联取消：

```typescript
// src/routes/export.ts
import { Router } from 'express';
import { runtime } from '../tasklane';
import { consumeResult, transferBuffers } from '@mapseekai/tasklane';

export const exportRouter = Router();

exportRouter.post('/api/export-report', async (req, res, next) => {
  // 1. 为本次 HTTP 请求派生专属 Scope
  const scope = runtime.createScope(`export-${Date.now()}-${Math.random()}`);

  // 2. 监听连接关闭：如果客户端提前取消请求（如用户按了浏览器的“停止”或关掉标签页）
  let isClosed = false;
  req.on('close', () => {
    isClosed = true;
    void scope.dispose(); // 立即取消该任务并归还 Worker 资源
  });

  try {
    const rawData = req.body.data; // 假设为大体积 ArrayBuffer 或数组

    const task = scope.enqueue('generateReport', {
      pool: 'heavy',
      budget: {
        inputBytes: rawData.byteLength,
        scratchBytes: 16 * 1024 * 1024,
        outputBytes: 8 * 1024 * 1024,
      },
      prepare() {
        return {
          payload: rawData,
          transfer: transferBuffers(rawData),
        };
      },
    });

    await consumeResult(task, (pdfBuffer) => {
      if (isClosed) return;
      res.setHeader('Content-Type', 'application/pdf');
      res.send(Buffer.from(pdfBuffer));
    });
  } catch (err) {
    if (!isClosed) {
      next(err);
    }
  } finally {
    // 3. 正常执行完毕后确保释放 Scope
    void scope.dispose();
  }
});
```

---

## 优雅下线（Graceful Shutdown）

在生产环境中，当 Kubernetes 触发滚动更新或运维执行 `docker stop` 时，Node.js 进程会收到 `SIGTERM` 或 `SIGINT` 信号。若不等待在飞任务结算就直接 `process.exit(0)`，可能导致计算文件损坏。

**标准的优雅退出流程**：

```typescript
// src/server.ts
import http from 'node:http';
import { app } from './app';
import { runtime } from './tasklane';

const server = http.createServer(app);

server.listen(3000, () => {
  console.log('Server running on port 3000');
});

async function gracefulShutdown(signal: string) {
  console.log(`收到 ${signal} 信号，开始优雅下线...`);

  // 1. 停止接收新的 HTTP 连接
  server.close(() => {
    console.log('HTTP 监听服务已关闭');
  });

  try {
    // 2. 关闭 tasklane 运行时：等待正在执行的任务结算，终止 Worker 线程
    console.log('正在等待后台任务完成并销毁 Worker 池...');
    await runtime.dispose();
    console.log('tasklane 运行时已安全释放');

    process.exit(0);
  } catch (error) {
    console.error('优雅退出异常:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

## 生产监控与指标采集

在 Node.js 服务中，可结合 Prometheus 或已有 APM 监控定期采集 tasklane 内部状态指标：

```typescript
// 定期输出或上报监控指标
setInterval(() => {
  const { workers, activeTasks, queuedTasks, leases } = runtime.stats;

  // 上报至 Prometheus / APM
  // metrics.activeWorkers.set(workers);
  // metrics.queuedTasks.set(queuedTasks);
  // metrics.activeLeases.set(leases);

  if (queuedTasks > 50) {
    console.warn(`[Tasklane Warning] 队列积压任务过多: ${queuedTasks}`);
  }
}, 5000);
```

详见[指标与故障诊断](/tasklane-web/docs/guides/diagnostics/)。
