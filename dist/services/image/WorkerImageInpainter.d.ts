import { ImageInpainter, InpaintRequest, InpaintResult } from '@/interfaces';
/**
 * Worker-backed inpainter.
 * Delegates heavy image processing to a dedicated Web Worker
 * so the UI thread remains responsive.
 */
export declare class WorkerImageInpainter implements ImageInpainter {
    private worker;
    private pendingRequests;
    private requestCounter;
    isAvailable(): Promise<boolean>;
    inpaint(req: InpaintRequest): Promise<InpaintResult>;
    dispose(): void;
    private getWorker;
}
//# sourceMappingURL=WorkerImageInpainter.d.ts.map