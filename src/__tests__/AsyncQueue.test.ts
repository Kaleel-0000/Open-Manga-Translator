import { AsyncQueue } from '../utils/AsyncQueue';

describe('AsyncQueue', () => {
  it('runs tasks and returns results', async () => {
    const queue = new AsyncQueue<number>(2);
    const result = await queue.enqueue({
      id: 'task-1',
      fn: async () => 42,
    });
    expect(result.result).toBe(42);
    expect(result.error).toBeUndefined();
  });

  it('respects concurrency limit', async () => {
    let concurrentCount = 0;
    let maxConcurrent = 0;
    const concurrency = 2;
    const queue = new AsyncQueue<void>(concurrency);

    const task = (id: string) =>
      queue.enqueue({
        id,
        fn: async () => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          await new Promise((r) => setTimeout(r, 20));
          concurrentCount--;
        },
      });

    await Promise.all([task('a'), task('b'), task('c'), task('d')]);
    expect(maxConcurrent).toBeLessThanOrEqual(concurrency);
  });

  it('retries failed tasks', async () => {
    let attempts = 0;
    const queue = new AsyncQueue<string>(1);

    const result = await queue.enqueue({
      id: 'retry-task',
      fn: async () => {
        attempts++;
        if (attempts < 3) throw new Error('Temporary failure');
        return 'success';
      },
      retries: 2,
    });

    expect(result.result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('permanently fails after max retries', async () => {
    const queue = new AsyncQueue<void>(1);
    const result = await queue.enqueue({
      id: 'fail-task',
      fn: async () => { throw new Error('Always fails'); },
      retries: 1,
    });

    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('Always fails');
  });

  it('processes tasks in priority order', async () => {
    const queue = new AsyncQueue<string>(1);
    const order: string[] = [];

    // Enqueue a blocker first to hold the slot
    const blocker = queue.enqueue({
      id: 'blocker',
      fn: () => new Promise((r) => setTimeout(() => r('blocker'), 30)),
      priority: 0,
    });

    // These queue up while blocker runs
    const low = queue.enqueue({ id: 'low', fn: async () => { order.push('low'); return 'low'; }, priority: 0 });
    const high = queue.enqueue({ id: 'high', fn: async () => { order.push('high'); return 'high'; }, priority: 10 });

    await Promise.all([blocker, low, high]);

    // High priority should run before low priority
    expect(order.indexOf('high')).toBeLessThan(order.indexOf('low'));
  });

  it('cancels queued tasks', async () => {
    const queue = new AsyncQueue<void>(1);

    // Block the single slot
    const blocker = queue.enqueue({
      id: 'blocker',
      fn: () => new Promise((r) => setTimeout(r, 50)),
    });

    // This queues up
    const cancelMe = queue.enqueue({ id: 'cancel-me', fn: async () => {} });
    const cancelled = queue.cancel('cancel-me');

    expect(cancelled).toBe(true);
    const result = await cancelMe;
    expect(result.error?.message).toBe('Cancelled');
    await blocker;
  });

  it('reports pending and running counts', async () => {
    const queue = new AsyncQueue<void>(1);
    let reportedPending = 0;

    const statusQueue = new AsyncQueue<void>(1, (pending) => {
      reportedPending = pending;
    });

    statusQueue.enqueue({ id: 'a', fn: () => new Promise((r) => setTimeout(r, 20)) });
    statusQueue.enqueue({ id: 'b', fn: async () => {} });
    statusQueue.enqueue({ id: 'c', fn: async () => {} });

    // Give queue time to start processing
    await new Promise((r) => setTimeout(r, 5));
    expect(statusQueue.pendingCount).toBeGreaterThan(0);

    await new Promise((r) => setTimeout(r, 100));
  });
});
