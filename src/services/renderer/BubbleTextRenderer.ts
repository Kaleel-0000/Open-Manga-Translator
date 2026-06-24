import { TextRenderer, TextRenderSpec } from '@/interfaces';

const PADDING = 4; // px inside bubble

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
export class BubbleTextRenderer implements TextRenderer {
  async render(
    canvas: HTMLCanvasElement,
    specs: TextRenderSpec[],
    imageWidth: number,
    imageHeight: number,
  ): Promise<void> {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    canvas.width = imageWidth;
    canvas.height = imageHeight;
    // Transparent background — we only draw text
    ctx.clearRect(0, 0, imageWidth, imageHeight);

    for (const spec of specs) {
      if (spec.orientation === 'vertical-rl' || spec.orientation === 'vertical-lr') {
        this.renderVertical(ctx, spec);
      } else {
        this.renderHorizontal(ctx, spec);
      }
    }
  }

  dispose(): void {}

  // ----------------------------------------------------------------
  private renderHorizontal(ctx: CanvasRenderingContext2D, spec: TextRenderSpec): void {
    const { bounds } = spec.polygon;
    const maxW = bounds.width - PADDING * 2;
    const maxH = bounds.height - PADDING * 2;

    if (maxW <= 0 || maxH <= 0) return;

    const fontFamily = spec.fontFamily ?? 'Bangers, "Comic Sans MS", sans-serif';
    const maxFontSize = spec.maxFontSize ?? 24;

    // Binary search for the largest font size that fits
    const fontSize = this.fitFontSize(ctx, spec.text, maxW, maxH, fontFamily, maxFontSize);

    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Outline for readability
    if (spec.strokeWidth !== undefined && spec.strokeWidth > 0) {
      ctx.strokeStyle = spec.strokeColor ?? '#000000';
      ctx.lineWidth = spec.strokeWidth;
      ctx.lineJoin = 'round';
    }

    const color = spec.color ?? '#ffffff';
    const cx = bounds.x + bounds.width / 2;
    const lines = this.wrapText(ctx, spec.text, maxW);
    const lineHeight = fontSize * 1.25;
    const totalHeight = lines.length * lineHeight;
    let startY = bounds.y + bounds.height / 2 - totalHeight / 2 + lineHeight / 2;

    for (const line of lines) {
      if (spec.strokeWidth !== undefined && spec.strokeWidth > 0) {
        ctx.strokeText(line, cx, startY);
      }
      ctx.fillStyle = color;
      ctx.fillText(line, cx, startY);
      startY += lineHeight;
    }

    ctx.restore();
  }

  private renderVertical(ctx: CanvasRenderingContext2D, spec: TextRenderSpec): void {
    const { bounds } = spec.polygon;
    const fontFamily = spec.fontFamily ?? 'Noto Sans CJK JP, sans-serif';
    const maxFontSize = spec.maxFontSize ?? 20;
    const fontSize = Math.min(maxFontSize, bounds.width - PADDING * 2);

    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const color = spec.color ?? '#1a1a1a';
    const chars = spec.text.split('');
    const charHeight = fontSize * 1.15;
    const col = spec.orientation === 'vertical-rl'
      ? bounds.x + bounds.width - fontSize / 2 - PADDING
      : bounds.x + fontSize / 2 + PADDING;

    let currentY = bounds.y + PADDING;

    for (const char of chars) {
      if (currentY + charHeight > bounds.y + bounds.height - PADDING) {
        // Move to next column
        const shift = spec.orientation === 'vertical-rl' ? -fontSize * 1.2 : fontSize * 1.2;
        ctx.translate(shift, 0);
        currentY = bounds.y + PADDING;
      }

      if (spec.strokeWidth !== undefined && spec.strokeWidth > 0) {
        ctx.strokeStyle = spec.strokeColor ?? '#000000';
        ctx.lineWidth = spec.strokeWidth;
        ctx.strokeText(char, col, currentY);
      }
      ctx.fillStyle = color;
      ctx.fillText(char, col, currentY);
      currentY += charHeight;
    }

    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Auto-sizing helpers
  // ----------------------------------------------------------------

  private fitFontSize(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxW: number,
    maxH: number,
    fontFamily: string,
    maxFontSize: number,
  ): number {
    let lo = 6, hi = maxFontSize;

    while (lo < hi - 1) {
      const mid = Math.floor((lo + hi) / 2);
      ctx.font = `${mid}px ${fontFamily}`;
      const lines = this.wrapText(ctx, text, maxW);
      const totalH = lines.length * mid * 1.25;
      const fits = totalH <= maxH;
      if (fits) lo = mid; else hi = mid;
    }

    return lo;
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines;
  }
}
