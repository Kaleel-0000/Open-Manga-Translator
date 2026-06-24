import { ImageInpainter, InpaintRequest, InpaintResult } from '@/interfaces';

/**
 * Worker-backed inpainter.
 * Delegates heavy image processing to a dedicated Web Worker
 * so the UI thread remains responsive.
 */
export class WorkerImageInpainter implements ImageInpainter {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    { resolve: (r: InpaintResult) => void; reject: (e: Error) => void }
  >();
  private requestCounter = 0;

  async isAvailable(): Promise<boolean> {
    return typeof Worker !== 'undefined';
  }

  async inpaint(req: InpaintRequest): Promise<InpaintResult> {
    const worker = this.getWorker();
    const id = String(this.requestCounter++);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      worker.postMessage({ ...req, _id: id });
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pendingRequests.clear();
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        chrome.runtime.getURL('workers/inpaint-worker.js'),
        { type: 'module' },
      );

      this.worker.onmessage = (e: MessageEvent<InpaintResult & { _id?: string; error?: string }>) => {
        const { _id, error, ...result } = e.data;
        if (!_id) return;
        const pending = this.pendingRequests.get(_id);
        if (!pending) return;
        this.pendingRequests.delete(_id);

        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(result as InpaintResult);
        }
      };

      this.worker.onerror = (e) => {
        for (const { reject } of this.pendingRequests.values()) {
          reject(new Error(`Inpaint worker error: ${e.message}`));
        }
        this.pendingRequests.clear();
      };
    }
    return this.worker;
  }
}
