export interface CacheResourceOptions {
  /** Dispose reader-owned cache data, then return the remaining reservation. */
  trim?(targetBytes: number): number | Promise<number>;
}
export interface CacheResourceLease {
  /** Complete current footprint plus absolute reader-owned cache counters. */
  report(snapshot: ResourceCacheReport): void;
  readonly bytes: number;
  readonly released: boolean;
  /** Grow before allocation, shrink after disposal. Failure preserves the previous accounting. */
  resize(bytes: number): void;
  /** Credits remain held until the disposer succeeds; failures can be retried. */
  release(): Promise<void>;
}
export interface ScopedCache {
  get<T = unknown>(key: string): T | undefined;
  /** Declared bytes are checked against backing stores plus scalar/key metadata. */
  set(key: string, value: unknown, bytes: number): void;
  /** Fresh native view, shared backing storage, no custom view properties. Charges the full buffer. */
  setBinary(key: string, value: ArrayBufferView): void;
  setPinned(key: string, value: unknown, bytes: number): void;
  /** Opaque session-owned state. Accounting is caller-declared; disposal is explicit and may be async. */
  setResource<T>(
    key: string,
    value: T,
    bytes: number,
    dispose: (value: T) => void | Promise<void>,
    options?: CacheResourceOptions,
  ): CacheResourceLease;
  delete(key: string): void | Promise<void>;
}
