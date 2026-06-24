import { OCRProvider, OCRResult, TextRegion, TextOrientation } from '@/interfaces';
import { createWorker, PSM, OEM } from 'tesseract.js';
import type { Worker as TesseractWorker } from 'tesseract.js';

// Language packs to preload (covers Japanese, Chinese Simplified/Traditional, Korean, English)
const DEFAULT_LANGS = 'jpn+jpn_vert+chi_sim+chi_tra+kor+eng';

/**
 * Tesseract.js OCR provider.
 *
 * Runs entirely in-browser with no network calls.
 * Language data is downloaded once and cached by Tesseract.
 */
export class TesseractOCRProvider implements OCRProvider {
  readonly id = 'tesseract';
  readonly displayName = 'Tesseract.js (Offline)';

  private worker: TesseractWorker | null = null;
  private initPromise: Promise<void> | null = null;

  private async init(): Promise<void> {
    if (this.worker) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.worker = await createWorker(DEFAULT_LANGS, OEM.LSTM_ONLY, {
        // Use the extension's bundled worker script
        workerPath: chrome.runtime.getURL('workers/tesseract-worker.js'),
        // Use CDN for language data (or set to extension URL if bundled)
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        cacheMethod: 'none', // We manage our own IDB cache
        logger: () => {}, // suppress progress logs
      });
    })();

    return this.initPromise;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.init();
      return true;
    } catch {
      return false;
    }
  }

  async recognize(imageUrl: string, _lang?: string): Promise<OCRResult> {
    await this.init();
    if (!this.worker) throw new Error('Tesseract worker not initialized');

    const start = Date.now();

    // Use SPARSE_TEXT PSM to find text blocks in varied layouts
    await this.worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });

    const { data } = await this.worker.recognize(imageUrl);

    const regions: TextRegion[] = [];

    for (const word of data.words) {
      if (!word.text.trim() || word.confidence < 20) continue;

      // Build polygon from bounding box
      const { x0, y0, x1, y1 } = word.bbox;
      const polygon = {
        points: [
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 },
        ],
        bounds: {
          x: x0,
          y: y0,
          width: x1 - x0,
          height: y1 - y0,
        },
      };

      regions.push({
        text: word.text,
        polygon,
        confidence: word.confidence / 100,
        orientation: this.detectOrientation(x0, y0, x1, y1),
        languageHint: this.guessLanguage(word.text),
      });
    }

    // Merge word-level regions into line-level regions for better translation context
    const merged = this.mergeIntoLines(regions);

    return {
      regions: merged,
      processingMs: Date.now() - start,
    };
  }

  dispose(): void {
    this.worker?.terminate().catch(() => {});
    this.worker = null;
    this.initPromise = null;
  }

  // ----------------------------------------------------------------
  private detectOrientation(
    x0: number, y0: number, x1: number, y1: number,
  ): TextOrientation {
    const width = x1 - x0;
    const height = y1 - y0;
    // Heuristic: if height significantly exceeds width, treat as vertical
    return height > width * 1.8 ? 'vertical-rl' : 'horizontal';
  }

  private guessLanguage(text: string): string | undefined {
    // Cheap script detection
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'; // Hiragana/Katakana
    if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';              // CJK ideographs
    if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';              // Hangul
    return undefined;
  }

  /**
   * Merge individual word regions that are on the same visual line
   * into a single region with concatenated text.
   */
  private mergeIntoLines(regions: TextRegion[]): TextRegion[] {
    if (regions.length === 0) return [];

    // Sort by top-y then left-x
    const sorted = [...regions].sort((a, b) => {
      const yDiff = a.polygon.bounds.y - b.polygon.bounds.y;
      return Math.abs(yDiff) < 10 ? a.polygon.bounds.x - b.polygon.bounds.x : yDiff;
    });

    const lines: TextRegion[][] = [];
    let currentLine: TextRegion[] = [sorted[0]!];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i]!;
      const prev = currentLine[currentLine.length - 1]!;
      const yDiff = Math.abs(current.polygon.bounds.y - prev.polygon.bounds.y);

      // Same line if top-Y is within one line-height
      const lineHeight = prev.polygon.bounds.height;
      if (yDiff < lineHeight * 0.6) {
        currentLine.push(current);
      } else {
        lines.push(currentLine);
        currentLine = [current];
      }
    }
    lines.push(currentLine);

    return lines.map((line): TextRegion => {
      const text = line.map((r) => r.text).join(' ').trim();
      const xs = line.flatMap((r) => r.polygon.points.map((p) => p.x));
      const ys = line.flatMap((r) => r.polygon.points.map((p) => p.y));
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const confidence =
        line.reduce((sum, r) => sum + r.confidence, 0) / line.length;

      return {
        text,
        polygon: {
          points: [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY },
          ],
          bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        },
        confidence,
        orientation: line[0]!.orientation,
        languageHint: line[0]!.languageHint,
      };
    });
  }
}
