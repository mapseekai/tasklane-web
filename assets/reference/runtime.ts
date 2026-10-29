export interface RuntimeOptions {
  interactiveReserve?: InteractiveReserve;
  pools: Record<string, PoolOptions>;
  maxWorkers?: number;
  maxActiveTasks?: number;
  /** Bounds asynchronous producers plus prepared inputs waiting for a Worker. Default 2. */
  maxPreparingTasks?: number;
  maxQueuedTasks?: number;
  /** Bounds held leases plus admitted work, including zero-binary-byte results. */
  maxResultLeases?: number;
  /** Bounds resident resource handles, including zero-byte reservations. Default 4096. */
  maxResourceLeases?: number;
  /** Maximum simultaneously open scopes, including children. */
  maxScopes?: number;
  budgets?: Partial<RuntimeBudgets>;
  startupTimeoutMs?: number;
  queueTimeoutMs?: number;
  executionTimeoutMs?: number;
  /** Strict priorities by default; opt into cross-priority ageing explicitly. */
  priorityPolicy?: 'strict' | 'ageing';
  /** Promotion interval for the ageing policy. */
  ageingMs?: number;
  maxAffinityEntries?: number;
  releaseTimeoutMs?: number;
  budgetWaitMs?: number;
  /** Observer exceptions are isolated from task execution. */
  onDiagnostic?: (error: RuntimeError) => void;
}

export interface RuntimeBudgets extends TaskBudget {
  /** Reservations for all resident worker caches, not just currently used entries. */
  cacheBytes: number;
  /** Caller-declared lifetime budget, independent of task/cache ceilings. Default 128 MiB. */
  residentBytes?: number;
}

export interface PoolOptions {
  factory: () => WorkerEndpoint;
  size: number;
  /** Per-Worker cache hard bound and default reservation. Zero disables persistent storage. */
  cacheBytes?: number;
  cacheEntries?: number;
  /** Hard cancellation may discard opportunistic caches. Sessions always have exclusive slots. */
  allowHardCancel?: boolean;
  /** A pooled, unpinned idle worker is reclaimed after this interval; 0 disables idle expiry. */
  idleTimeoutMs?: number;
  /** Worker slots unavailable to non-interactive admissions. */
  interactiveWorkers?: number;
  /** Opt-in feedback controller. size/cacheBytes remain hard upper bounds. */
  adaptive?: AdaptivePoolOptions;
}

export interface AdaptivePoolOptions {
  minWorkers?: number;
  minCacheBytes?: number;
  sampleMs?: number;
  idleMs?: number;
  missRatio?: number;
}

export interface InteractiveReserve {
  workers?: number;
  activeTasks?: number;
  preparingTasks?: number;
  resultLeases?: number;
  budgets?: Partial<RuntimeBudgets>;
}
