import { OCRProvider, OCRResult, TextRegion, TextOrientation } from '@/interfaces';

interface AzureLine {
  text: string;
  boundingBox: number[]; // [x0,y0, x1,y1, x2,y2, x3,y3]
  words: { text: string; boundingBox: number[]; confidence: number }[];
}

interface AzureReadResult {
  lines: AzureLine[];
  language?: string;
}

interface AzureAnalyzeResult {
  analyzeResult: { readResults: AzureReadResult[] };
}

/**
 * Azure Computer Vision (Read API v3.2) OCR provider.
 * Excellent accuracy on Japanese/Korean/Chinese manga.
 */
export class AzureVisionOCRProvider implements OCRProvider {
  readonly id = 'azure-vision';
  readonly displayName = 'Azure Computer Vision';

  constructor(
    private readonly endpoint: string, // e.g. https://<region>.api.cognitive.microsoft.com
    private readonly apiKey: string,
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.endpoint && this.apiKey);
  }

  async recognize(imageUrl: string): Promise<OCRResult> {
    const start = Date.now();
    const readUrl = `${this.endpoint}/vision/v3.2/read/analyze`;

    // Submit the image for async analysis
    const submitRes = await fetch(readUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: imageUrl }),
    });

    if (!submitRes.ok) {
      throw new Error(`Azure Vision submit error: ${submitRes.status}`);
    }

    // Azure returns the result URL in the Operation-Location header
    const operationUrl = submitRes.headers.get('Operation-Location');
    if (!operationUrl) throw new Error('Azure Vision: missing Operation-Location');

    // Poll until done (typically 1–3 seconds)
    const result = await this.pollResult(operationUrl);
    const regions = this.parseResult(result);

    return { regions, processingMs: Date.now() - start };
  }

  dispose(): void {}

  // ----------------------------------------------------------------
  private async pollResult(operationUrl: string): Promise<AzureAnalyzeResult> {
    const maxAttempts = 20;
    const delayMs = 500;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, delayMs));

      const res = await fetch(operationUrl, {
        headers: { 'Ocp-Apim-Subscription-Key': this.apiKey },
      });

      if (!res.ok) throw new Error(`Azure Vision poll error: ${res.status}`);

      const data: { status: string } & Partial<AzureAnalyzeResult> = await res.json();
      if (data.status === 'succeeded') return data as AzureAnalyzeResult;
      if (data.status === 'failed') throw new Error('Azure Vision: analysis failed');
    }

    throw new Error('Azure Vision: timed out waiting for result');
  }

  private parseResult(data: AzureAnalyzeResult): TextRegion[] {
    const regions: TextRegion[] = [];

    for (const readResult of data.analyzeResult.readResults) {
      for (const line of readResult.lines) {
        const bb = line.boundingBox; // [x0,y0, x1,y1, x2,y2, x3,y3]
        const xs = [bb[0]!, bb[2]!, bb[4]!, bb[6]!];
        const ys = [bb[1]!, bb[3]!, bb[5]!, bb[7]!];
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);

        const avgConf = line.words.length
          ? line.words.reduce((s, w) => s + (w.confidence ?? 0.9), 0) / line.words.length
          : 0.9;

        regions.push({
          text: line.text,
          polygon: {
            points: [
              { x: bb[0]!, y: bb[1]! }, { x: bb[2]!, y: bb[3]! },
              { x: bb[4]!, y: bb[5]! }, { x: bb[6]!, y: bb[7]! },
            ],
            bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          },
          confidence: avgConf,
          orientation: this.detectOrientation(minX, minY, maxX, maxY),
          languageHint: readResult.language,
        });
      }
    }

    return regions;
  }

  private detectOrientation(
    x0: number, y0: number, x1: number, y1: number,
  ): TextOrientation {
    return (y1 - y0) > (x1 - x0) * 1.8 ? 'vertical-rl' : 'horizontal';
  }
}
