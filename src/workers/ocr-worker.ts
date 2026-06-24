/**
 * OCR Web Worker
 *
 * Runs Tesseract.js OCR in a dedicated worker thread.
 * Receives image data URLs, returns OCR results.
 */

import { createWorker, PSM, OEM } from 'tesseract.js';
import type { OCRResult } from '@/interfaces';

interface WorkerRequest {
  id: string;
  imageDataUrl: string;
  lang?: string;
}

interface WorkerResponse {
  id: string;
  result?: OCRResult;
  error?: string;
}

let tesseractWorker: Awaited<ReturnType<typeof createWorker>> | null = null;

async function ensureWorker(): Promise<void> {
  if (tesseractWorker) return;
  tesseractWorker = await createWorker(
    'jpn+jpn_vert+chi_sim+chi_tra+kor+eng',
    OEM.LSTM_ONLY,
    {
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      cacheMethod: 'none',
      logger: () => {},
    },
  );
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, imageDataUrl } = e.data;

  try {
    await ensureWorker();
    if (!tesseractWorker) throw new Error('Worker not initialized');

    await tesseractWorker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });

    const { data } = await tesseractWorker.recognize(imageDataUrl);
    const start = Date.now();

    const regions = data.words
      .filter((w) => w.text.trim() && w.confidence > 20)
      .map((word) => {
        const { x0, y0, x1, y1 } = word.bbox;
        return {
          text: word.text,
          polygon: {
            points: [
              { x: x0, y: y0 }, { x: x1, y: y0 },
              { x: x1, y: y1 }, { x: x0, y: y1 },
            ],
            bounds: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
          },
          confidence: word.confidence / 100,
          orientation: ((y1 - y0) > (x1 - x0) * 1.8 ? 'vertical-rl' : 'horizontal') as 'horizontal' | 'vertical-rl',
        };
      });

    const response: WorkerResponse = {
      id,
      result: { regions, processingMs: Date.now() - start },
    };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = { id, error: String(err) };
    self.postMessage(response);
  }
};
