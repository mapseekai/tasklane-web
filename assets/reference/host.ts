export interface TaskOutput<T> {
  value: T;
  transfer?: readonly Transferable[];
}
export function output<T>(value: T, transfer: readonly Transferable[] = []): TaskOutput<T> {
  return { value, transfer };
}
export interface HostContext {
  readonly signal: AbortSignal;
  /** Reserved packet bytes for this task's output, available before allocating a chunk. */
  readonly outputLimit: number;
  readonly scopeId: string;
  readonly sessionId?: string;
  readonly epoch: number;
  readonly cache: ScopedCache;
  /** Task-owned, measured backing stores. Allocations outside this arena are not tracked. */
  readonly scratch: ScratchArena;
  /** Throttled to at most one message per 16ms per physical task. */
  progress(value: unknown): void;
  /** A real task-queue yield. Promise.resolve() is NOT sufficient for cancellation messages. */
  checkpoint(): Promise<void>;
}
export type TaskHandler<I, O> = (
  payload: I,
  context: HostContext,
) => TaskOutput<O> | Promise<TaskOutput<O>>;
export type TaskHandlers<T extends Catalog<T>> = {
  [K in keyof T]: TaskHandler<T[K]['input'], T[K]['output']>;
};
