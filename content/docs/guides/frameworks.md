---
title: 主流前端框架集成
description: 在 React 与 Vue 3 中优雅管理 tasklane 实例生命周期、状态响应与组件卸载清理。
weight: 8
doc_type: how-to
---

在现代单页应用（SPA）中集成 Worker 调度器时，开发者常面临两大挑战：**避免组件重新渲染时重复创建 Runtime 实例**，以及**在组件卸载时及时级联取消排队与执行中的任务、释放内存租约**。

本指南提供在 React 与 Vue 3 中封装与集成 tasklane 的标准化工程模式。

---

## 核心集成架构原则

```
┌────────────────────────────────────────────────────────┐
│                   App 根应用 (单例模式)                 │
│    createWorkerRuntime (全局持久, 维护 Worker 池与预算账本) │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│ React 组件 A (挂载时)  │       │  Vue 组件 B (挂载时)   │
│ runtime.createScope() │       │ runtime.createScope() │
│ scope.enqueue 投递任务 │       │ scope.enqueue 投递任务 │
├───────────────────────┤       ├───────────────────────┤
│ 组件卸载:              │       │ 组件卸载:             │
│ scope.dispose()       │       │ scope.dispose()       │
│ (任务被级联取消并清理)  │       │ (任务被级联取消并清理)  │
└───────────────────────┘       └───────────────────────┘
```

1. **单例 Runtime 原则**：`WorkerRuntime` 维护着底层的 Worker 线程池和五类预算账本（`BudgetLedger`），必须在应用生命周期内保持单例，**严禁在组件渲染函数内重复 `createWorkerRuntime()`**。
2. **作用域（Scope）与生命周期绑定**：每个业务组件应当创建专属的 `Scope`（通过 `runtime.createScope('my-feature')`）。当用户离开页面或组件卸载时，直接调用 `scope.dispose()`，调度器会自动下发取消信号并清理该组件关联的排队任务与内存租约。
3. **响应式解耦（避免深度 Proxy）**：计算结果通常是大体积二进制数据（如 `Float32Array`），在 Vue 中建议使用 `shallowRef`，在 React 中建议按需存储切片，避免框架深度劫持引起 UI 线程卡顿。

---

## 在 React 中集成

### 1. 创建全局 Provider 与 Context

在应用顶层维护唯一的调度器实例：

```tsx
// src/context/TasklaneContext.tsx
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { createWorkerRuntime, browserWorker } from '@mapseekai/tasklane';

type TasklaneRuntime = ReturnType<typeof createWorkerRuntime>;

const TasklaneContext = createContext<TasklaneRuntime | null>(null);

export const TasklaneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const runtime = useMemo(() => {
    return createWorkerRuntime({
      pools: {
        compute: {
          factory: browserWorker(new URL('../workers/compute.worker.ts', import.meta.url)),
          size: 2,
        },
      },
      maxWorkers: 2,
    });
  }, []);

  useEffect(() => {
    return () => {
      // 当应用卸载或热重载时释放底层 Worker 线程与账本
      void runtime.dispose();
    };
  }, [runtime]);

  return (
    <TasklaneContext.Provider value={runtime}>
      {children}
    </TasklaneContext.Provider>
  );
};

export const useTasklane = () => {
  const runtime = useContext(TasklaneContext);
  if (!runtime) {
    throw new Error('useTasklane 必须在 TasklaneProvider 内部使用');
  }
  return runtime;
};
```

### 2. 封装组件级任务执行 Hook (`useTaskExecution`)

封装一个自动感知组件卸载并自动释放租约的 Hook：

```tsx
// src/hooks/useTaskExecution.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { useTasklane } from '../context/TasklaneContext';
import { consumeResult, transferBuffers } from '@mapseekai/tasklane';

export function useTaskExecution<TResult>() {
  const runtime = useTasklane();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TResult | null>(null);
  const scopeRef = useRef<ReturnType<typeof runtime.createScope> | null>(null);

  // 组件挂载时创建独立作用域，卸载时级联释放所有任务与未释放租约
  useEffect(() => {
    const scope = runtime.createScope('component-task-scope');
    scopeRef.current = scope;

    return () => {
      void scope.dispose();
      scopeRef.current = null;
    };
  }, [runtime]);

  const runTask = useCallback(
    async (action: string, inputBuffer: Float64Array) => {
      if (!scopeRef.current) return;
      setLoading(true);
      setError(null);

      try {
        const task = scopeRef.current.enqueue(action, {
          pool: 'compute',
          budget: {
            inputBytes: inputBuffer.byteLength,
            scratchBytes: 0,
            outputBytes: inputBuffer.byteLength / 2, // 假设计算产出 Float32Array
          },
          prepare() {
            return {
              payload: inputBuffer,
              transfer: transferBuffers(inputBuffer),
            };
          },
        });

        // consumeResult 会在回调函数执行完毕后自动释放租约并归还 outputBytes 额度
        await consumeResult(task, (result) => {
          setData(result as TResult);
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { runTask, loading, error, data };
}
```

---

## 在 Vue 3 中集成 (Composition API)

在 Vue 3 中，推荐使用模块级单例配合组合式函数：

### 1. 组合式函数 `useTaskLane`

```typescript
// src/composables/useTaskLane.ts
import { shallowRef, ref, onUnmounted } from 'vue';
import { createWorkerRuntime, browserWorker, consumeResult, transferBuffers } from '@mapseekai/tasklane';

let globalRuntime: ReturnType<typeof createWorkerRuntime> | null = null;

function getRuntime() {
  if (!globalRuntime) {
    globalRuntime = createWorkerRuntime({
      pools: {
        compute: {
          factory: browserWorker(new URL('../workers/compute.worker.ts', import.meta.url)),
          size: 2,
        },
      },
      maxWorkers: 2,
    });
  }
  return globalRuntime;
}

export function useTaskLane<TResult>() {
  const runtime = getRuntime();
  const scope = runtime.createScope('vue-component-scope');

  const loading = ref(false);
  const error = ref<Error | null>(null);
  // 使用 shallowRef 避免 Vue 响应式系统对几十兆的 TypedArray 结果进行无意义的深度递归 Proxy 代理
  const data = shallowRef<TResult | null>(null);

  const execute = async (action: string, inputData: Float64Array) => {
    loading.value = true;
    error.value = null;

    try {
      const task = scope.enqueue(action, {
        pool: 'compute',
        budget: {
          inputBytes: inputData.byteLength,
          scratchBytes: 0,
          outputBytes: inputData.byteLength / 2,
        },
        prepare() {
          return {
            payload: inputData,
            transfer: transferBuffers(inputData),
          };
        },
      });

      await consumeResult(task, (result) => {
        data.value = result as TResult;
      });
    } catch (err: unknown) {
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      loading.value = false;
    }
  };

  // 组件卸载时自动销毁 Scope，终止正在计算的任务，归还所有被占用的预算额度
  onUnmounted(() => {
    void scope.dispose();
  });

  return { execute, loading, error, data };
}
```

---

## 构建工具与 SSR 避坑指南

### 1. Vite 环境下的 Worker 引用
在 Vite 中，务必使用 ECMAScript 标准 URL 语法，并声明 `{ type: 'module' }`：

```typescript
import { browserWorker } from '@mapseekai/tasklane';

const runtime = createWorkerRuntime({
  pools: {
    compute: {
      factory: browserWorker(new URL('./worker.ts', import.meta.url)),
      size: 2,
    },
  },
});
```

### 2. Next.js (App Router) 服务端渲染保护
Node.js 服务端渲染（SSR）阶段不存在浏览器 `Worker` API。如果调度器在服务端被实例化，会触发 `ReferenceError: Worker is not defined`。

**解决方案**：仅在客户端动态加载组件或增加环境守护判断：

```tsx
// 在 Next.js 客户端组件中使用
'use client';

import dynamic from 'next/dynamic';

// 方案 A: 动态导入并禁用 SSR
const HeavyDataViewer = dynamic(() => import('./HeavyDataViewer'), {
  ssr: false,
});

// 方案 B: 在 useEffect 内部初始化浏览器端任务
useEffect(() => {
  if (typeof window !== 'undefined') {
    // 此时已处于浏览器环境，安全调用 Worker 运算
  }
}, []);
```
