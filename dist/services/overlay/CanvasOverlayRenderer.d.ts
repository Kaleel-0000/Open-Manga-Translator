import { OverlayRenderer, TextRenderSpec } from '@/interfaces';
/**
 * Creates a stacked overlay on comic images:
 *   [wrapper div]
 *     [original img]           (hidden when translated)
 *     [inpainted img canvas]   (background layer)
 *     [text canvas]            (text layer)
 *
 * The wrapper mirrors the image's dimensions and position.
 * The original image is never modified.
 */
export declare class CanvasOverlayRenderer implements OverlayRenderer {
    private readonly renderer;
    /** Map from image URL to wrapper element */
    private readonly wrappers;
    attach(target: HTMLImageElement, inpaintedDataUrl: string, textSpecs: TextRenderSpec[]): Promise<HTMLElement>;
    detach(target: HTMLImageElement): void;
    toggle(target: HTMLImageElement): void;
    dispose(): void;
    private findWrapper;
}
//# sourceMappingURL=CanvasOverlayRenderer.d.ts.map