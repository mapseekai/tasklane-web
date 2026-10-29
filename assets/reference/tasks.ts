export interface TaskType<Input = unknown, Output = unknown> {
  input: Input;
  output: Output;
}

export interface TaskBudget {
  inputBytes: number;
  scratchBytes: number;
  outputBytes: number;
}

export interface TaskOptions<Input> {
  pool: string;
  budget: TaskBudget;
  /** Per-packet logical Blob/File sizes; defaults to zero. Not reserved heap/RSS credits. */
  blobLimits?: { inputBytes: number; outputBytes: number };
  /** Runs synchronously in the caller realm while holding a Worker. Keep CPU-heavy work in handlers. */
  prepare(context: { signal: AbortSignal }): PreparedInput<Input>;
  priority?: Priority;
  /** Fairness is per scope + group, not merely per task. */
  group?: string;
  /** Soft, bounded cache affinity. Use a Session for required affinity. */
  affinity?: TaskAffinity;
  cancellation?: Cancellation;
  signal?: AbortSignal;
  queueTimeoutMs?: number;
  /** Includes startup, prepare, and physical worker execution, but not queue waiting. */
  executionTimeoutMs?: number;
  /** Discard successful values and return output credits before settled. result resolves a released lease. */
  discardResult?: boolean;
  onProgress?: (value: unknown) => void;
}

export interface PreparedInput<T> {
  payload: T;
  /** Explicit ownership transfer. The runtime never automatically detaches input buffers. */
  transfer?: readonly Transferable[];
}

export interface PreparedTaskOptions<Input> extends Omit<TaskOptions<Input>, 'prepare'> {
  /** Runs in the caller realm without a Worker; async I/O can overlap, synchronous work still blocks. */
  prepareAsync(context: {
    signal: AbortSignal;
  }): PreparedInput<Input> | Promise<PreparedInput<Input>>;
  /** Main-realm temporary data upper bound; reserved together with the task budget. */
  preparationScratchBytes: number;
  /** Bounds the producer phase; executionTimeoutMs covers all admitted phases together. */
  preparationTimeoutMs?: number;
}

export interface TaskHandle<T> {
  readonly id: string;
  readonly state: TaskState;
  readonly timing: Readonly<TaskTiming>;
  readonly result: Promise<ResultLease<T>>;
  /** Physical completion, including cancelled work. Never rejects. */
  readonly settled: Promise<void>;
  cancel(reason?: unknown): void;
}

export interface TaskTiming {
  queueMs: number;
  startupMs: number;
  prepareMs: number;
  roundTripMs: number;
  workerMs: number;
  totalMs: number;
}

export interface ResultLease<T> {
  /** Throws after release. External references retained by the caller cannot be erased. */
  readonly value: T;
  readonly byteLength: number;
  readonly released: boolean;
  release(): void;
}
