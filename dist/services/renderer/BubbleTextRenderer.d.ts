import { TextRenderer, TextRenderSpec } from '@/interfaces';
/**
 * Canvas text renderer with bubble-aware layout.
 *
 * Features:
 * - Automatically fits font size to bubble bounds
 * - Dynamic word wrapping
 * - Vertical text support (CJK)
 * - Stroke/outline for readability
 * - Center-aligned by default
 */
export declare class BubbleTextRenderer implements TextRenderer {
    render(canvas: HTMLCanvasElement, specs: TextRenderSpec[], imageWidth: number, imageHeight: number): Promise<void>;
    dispose(): void;
    private renderHorizontal;
    private renderVertical;
    private fitFontSize;
    private wrapText;
}
//# sourceMappingURL=BubbleTextRenderer.d.ts.map