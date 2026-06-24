/**
 * AsyncQueue — concurrency-limited task queue with retry support.
 *
 * Used to process multiple comic images concurrently without hammering
 * translation APIs or exhausting memory with hundreds of parallel inpaint ops.
 */

export interface QueueTask<T> {
  id: string;
  fn: () => Promise<T>;
  priority?: number; // higher = sooner; default 0
  retries?: number;  // max retry attempts; default 2
}

export interface QueueResult<T> {
  id: string;
  result?: T;
  error?: Error;
}

type TaskEntry<T> = QueueTask<T> & {
  resolve: (r: QueueResult<T>) => void;
  attempts: number;
};

export class AsyncQueue<T> {
  private readonly queue: TaskEntry<T>[] = [];
  private running = 0;

  constructor(
    private readonly concurrency: number = 2,
    private readonly onStatusChange?: (queueLength: number, running: number) => void,
  ) {}

  enqueue(task: QueueTask<T>): Promise<QueueResult<T>> {
    return new Promise((resolve) => {
      const entry: TaskEntry<T> = {
        ...task,
        resolve,
        attempts: 0,
        priority: task.priority ?? 0,
        retries: task.retries ?? 2,
      };

      // Insert in priority order (higher priority first)
      const insertAt = this.queue.findIndex((t) => (t.priority ?? 0) < entry.priority!);
      if (insertAt === -1) {
        this.queue.push(entry);
      } else {
        this.queue.splice(insertAt, 0, entry);
      }

      this.onStatusChange?.(this.queue.length, this.running);
      this.drain();
    });
  }

  /** Cancel a queued (not yet running) task by id */
  cancel(id: string): boolean {
    const idx = this.queue.findIndex((t) => t.id === id);
    if (idx !== -1) {
      const [task] = this.queue.splice(idx, 1);
      task?.resolve({ id, error: new Error('Cancelled') });
      return true;
    }
    return false;
  }

  /** Clear all pending tasks */
  clear(): void {
    while (this.queue.length > 0) {
      const task = this.queue.pop()!;
      task.resolve({ id: task.id, error: new Error('Queue cleared') });
    }
  }

  get pendingCount(): number { return this.queue.length; }
  get runningCount(): number { return this.running; }

  // ----------------------------------------------------------------
  private drain(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running++;
      this.onStatusChange?.(this.queue.length, this.running);
      this.run(task);
    }
  }

  private async run(task: TaskEntry<T>): Promise<void> {
    task.attempts++;
    try {
      const result = await task.fn();
      task.resolve({ id: task.id, result });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (task.attempts <= (task.retries ?? 2)) {
        // Exponential back-off before retry
        const delay = Math.min(1000 * 2 ** (task.attempts - 1), 8000);
        console.warn(
          `[AsyncQueue] Task ${task.id} failed (attempt ${task.attempts}), retrying in ${delay}ms:`,
          error.message,
        );
        await new Promise((r) => setTimeout(r, delay));
        this.queue.unshift(task); // re-insert at front (same priority)
      } else {
        console.error(`[AsyncQueue] Task ${task.id} permanently failed:`, error);
        task.resolve({ id: task.id, error });
      }
    } finally {
      this.running--;
      this.onStatusChange?.(this.queue.length, this.running);
      this.drain();
    }
  }
}
