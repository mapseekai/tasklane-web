export interface SessionOptions {
  /** Resource admission class; task priority defaults to this class. */
  priority?: Priority;
  /** Only idle Sessions without pending tasks or held results may be reclaimed. */
  reclaimable?: boolean;
  /** Lower values are reclaimed first, then least recently used. Default 0. */
  reclaimPriority?: number;
}

export interface SessionAdmissionOptions extends SessionOptions {
  /** Reserve lifetime bytes together with the Worker; exposed as session.resident. */
  residentBytes?: number;
  /** Immediate reserves available capacity or rejects; wait queues until capacity is available. */
  mode?: 'immediate' | 'wait';
  signal?: AbortSignal;
  /** Includes waiting and startup; defaults to queueTimeoutMs. */
  timeoutMs?: number;
}

export interface ResourceOptions {
  kind: 'resident';
  bytes: number;
  priority?: Priority;
}

export interface ResourceLease {
  readonly bytes: number;
  readonly released: boolean;
  /** Atomic, exact resize. Failure leaves the previous reservation intact. */
  resize(bytes: number): void;
  release(): void;
}

export interface ResourceReservations {
  acquire(options: ResourceOptions): ResourceLease;
}

export interface PoolSizing {
  size?: number;
  cacheBytes?: number;
}

export interface TrimOptions {
  pool?: string;
  cacheBytesPerWorker?: number;
  workersPerPool?: number;
  reclaimSessions?: boolean;
}

export interface MaintenanceReport {
  workersReclaimed: number;
  cacheBytesReleased: number;
  failures: readonly { pool: string; worker: number; message: string }[];
}
