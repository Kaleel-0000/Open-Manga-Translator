import { OCRProvider, OCRResult, TextRegion, TextOrientation } from '@/interfaces';

interface GVisionVertex { x?: number; y?: number }
interface GVisionAnnotation {
  description: string;
  confidence?: number;
  boundingPoly: { vertices: GVisionVertex[] };
}

/**
 * Google Cloud Vision OCR provider.
 * Requires a GCP API key stored in extension settings.
 */
export class GoogleVisionOCRProvider implements OCRProvider {
  readonly id = 'google-vision';
  readonly displayName = 'Google Cloud Vision';

  constructor(private readonly apiKey: string) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async recognize(imageUrl: string): Promise<OCRResult> {
    const start = Date.now();

    // Fetch the image and base64-encode it for the Vision API
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const base64 = await this.blobToBase64(blob);

    const body = {
      requests: [{
        image: { content: base64 },
        features: [{ type: 'TEXT_DETECTION' }],
      }],
    };

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!visionResponse.ok) {
      throw new Error(`Google Vision API error: ${visionResponse.status}`);
    }

    const data = await visionResponse.json() as {
      responses: [{ textAnnotations?: GVisionAnnotation[] }]
    };

    const annotations = data.responses[0]?.textAnnotations ?? [];
    // Skip the first annotation — it's the full page text
    const wordAnnotations = annotations.slice(1);

    const regions: TextRegion[] = wordAnnotations.map((ann): TextRegion => {
      const verts = ann.boundingPoly.vertices;
      const xs = verts.map((v) => v.x ?? 0);
      const ys = verts.map((v) => v.y ?? 0);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const points = verts.map((v) => ({ x: v.x ?? 0, y: v.y ?? 0 }));

      return {
        text: ann.description,
        polygon: {
          points,
          bounds: {
            x: minX, y: minY,
            width: maxX - minX,
            height: maxY - minY,
          },
        },
        confidence: ann.confidence ?? 0.9,
        orientation: this.detectOrientation(minX, minY, maxX, maxY),
      };
    });

    return { regions, processingMs: Date.now() - start };
  }

  dispose(): void {}

  private detectOrientation(
    x0: number, y0: number, x1: number, y1: number,
  ): TextOrientation {
    return (y1 - y0) > (x1 - x0) * 1.8 ? 'vertical-rl' : 'horizontal';
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
