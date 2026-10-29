export interface RuntimeStats {
  resourceCacheStats: Readonly<CacheStats>;
  reclaim: Readonly<ReclaimStats>;
  scheduler: { blockedBuckets: number; eligibilityChecks: number; wakeups: number };
  cacheStats: Readonly<CacheStats>;
  queued: number;
  active: number;
  preparing: number;
  prepared: number;
  /** Reserved input/scratch/output envelopes of preparing and prepared tasks. */
  preparationReserved: TaskBudget;
  workers: number;
  closingWorkers: number;
  leases: number;
  resourceLeases: number;
  sessionsReclaimed: number;
  scopes: number;
  quarantinedWorkers: number;
  reserved: Required<RuntimeBudgets>;
  peakReserved: Required<RuntimeBudgets>;
  cacheUsedBytes: number;
  completed: number;
  cancelled: number;
  failed: number;
  workerStarts: number;
  workerTerminations: number;
  inputBytes: number;
  outputBytes: number;
  observerErrors: number;
}

export interface RuntimeDiagnostics {
  readonly memoryPressure: MemoryPressure;
  readonly limits: Readonly<RuntimeBudgets> & {
    readonly maxWorkers: number;
    readonly maxActiveTasks: number;
    readonly maxPreparingTasks: number;
    readonly maxResultLeases: number;
    readonly maxQueuedTasks: number;
    readonly maxResourceLeases: number;
  };
  readonly pools: readonly PoolDiagnostics[];
  readonly waiting: readonly {
    readonly id: string;
    readonly pool: string;
    readonly session?: string;
    readonly kind: 'task' | 'session';
    readonly reasons: readonly AdmissionBlocker[];
  }[];
}

export interface PoolDiagnostics {
  readonly resourceCacheStats: Readonly<CacheStats>;
  readonly resources: readonly ResourceCacheSnapshot[];
  readonly reclaim: Readonly<ReclaimStats>;
  readonly maxCapacity: number;
  readonly maxCacheBytesPerWorker: number;
  readonly adaptive: boolean;
  readonly cacheStats: Readonly<CacheStats>;
  readonly name: string;
  readonly capacity: number;
  readonly workers: number;
  readonly starting: number;
  readonly running: number;
  readonly idle: number;
  readonly sessionIdle: number;
  readonly closing: number;
  readonly quarantined: number;
  readonly boundSessions: number;
  readonly reclaimableSessions: number;
  readonly waitingSessions: number;
  readonly queuedTasks: number;
  readonly cacheBytesPerWorker: number;
  readonly cacheReservedBytes: number;
  readonly cacheUsedBytes: number;
  readonly blockers: readonly AdmissionBlocker[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
}

export interface ReclaimStats {
  attempts: number;
  succeeded: number;
  failed: number;
  byReason: Record<ReclaimReason, number>;
}

export interface ResourceCacheSnapshot extends ResourceCacheReport {
  id: string;
  scope: string;
  session: string;
  resource: string;
  reservedBytes: number;
}

export interface ResourceCacheReport extends CacheStats {
  usedBytes: number;
  keys: readonly string[];
}
