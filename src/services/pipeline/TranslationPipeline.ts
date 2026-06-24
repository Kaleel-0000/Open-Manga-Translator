import {
  OCRProvider, TranslationProvider, ImageInpainter, OverlayRenderer,
  CacheProvider, PipelineOptions, PipelineResult, TextRenderSpec,
  ExtensionSettings,
} from '@/interfaces';
import { createHash } from '@/utils/hash';

export type PipelineEventCallback = (
  imageUrl: string,
  status: 'ocr' | 'translating' | 'rendering' | 'done' | 'error',
  detail?: string,
) => void;

/**
 * TranslationPipeline
 *
 * The central coordinator for translating a single comic image.
 * It is stateless with respect to images — call translate() any number of times.
 *
 * Dependency-injected: swap any provider without touching this class.
 */
export class TranslationPipeline {
  constructor(
    private readonly ocr: OCRProvider,
    private readonly translator: TranslationProvider,
    private readonly inpainter: ImageInpainter,
    private readonly overlay: OverlayRenderer,
    private readonly cache: CacheProvider,
    private readonly settings: ExtensionSettings,
  ) {}

  async translate(
    imageEl: HTMLImageElement,
    imageDataUrl: string,
    options: PipelineOptions,
    onStatus?: PipelineEventCallback,
  ): Promise<PipelineResult> {
    const imageUrl = imageEl.src;
    const cacheKey = `pipeline:${await createHash(imageUrl + options.targetLang)}`;

    // --- Cache check ---
    if (this.settings.cacheEnabled) {
      const cached = await this.cache.get<PipelineResult>(cacheKey);
      if (cached) {
        // Re-attach overlay (DOM element can't be cached, but we have data)
        const overlayEl = await this.overlay.attach(
          imageEl,
          cached.imageUrl,
          this.buildTextSpecs(cached),
        );
        return { ...cached, overlay: overlayEl };
      }
    }

    // --- Step 1: OCR ---
    onStatus?.(imageUrl, 'ocr');
    const ocrCacheKey = `ocr:${await createHash(imageUrl)}`;
    let ocrResult = this.settings.cacheEnabled
      ? await this.cache.get<Awaited<ReturnType<OCRProvider['recognize']>>>(ocrCacheKey)
      : null;

    if (!ocrResult) {
      ocrResult = await this.ocr.recognize(imageDataUrl, options.sourceLang);
      if (this.settings.cacheEnabled) {
        await this.cache.set(
          ocrCacheKey,
          ocrResult,
          this.settings.cacheTtlHours * 3_600_000,
        );
      }
    }

    // Filter out low-confidence / SFX regions
    const regions = ocrResult.regions.filter(
      (r) => r.confidence > 0.35 && (options.translateSfx || !r.isSfx),
    );

    if (regions.length === 0) {
      throw new Error('No text regions detected');
    }

    // --- Step 2: Translation ---
    onStatus?.(imageUrl, 'translating');
    const transCacheKey = `trans:${await createHash(
      regions.map((r) => r.text).join('|') + options.targetLang,
    )}`;

    let translations: string[];
    const cachedTrans = this.settings.cacheEnabled
      ? await this.cache.get<string[]>(transCacheKey)
      : null;

    if (cachedTrans) {
      translations = cachedTrans;
    } else {
      const response = await this.translator.translate({
        texts: regions.map((r) => r.text),
        sourceLang: options.sourceLang,
        targetLang: options.targetLang,
      });
      translations = response.translations;
      if (this.settings.cacheEnabled) {
        await this.cache.set(
          transCacheKey,
          translations,
          this.settings.cacheTtlHours * 3_600_000,
        );
      }
    }

    // --- Step 3: Inpainting (text removal) ---
    onStatus?.(imageUrl, 'rendering');
    const inpaintCacheKey = `inpaint:${await createHash(imageUrl)}`;
    let inpaintedDataUrl: string;
    const cachedInpaint = this.settings.cacheEnabled
      ? await this.cache.get<string>(inpaintCacheKey)
      : null;

    if (cachedInpaint) {
      inpaintedDataUrl = cachedInpaint;
    } else {
      const inpaintResult = await this.inpainter.inpaint({
        imageDataUrl,
        regions: regions.map((r) => r.polygon),
        quality: options.inpaintQuality,
      });
      inpaintedDataUrl = inpaintResult.imageDataUrl;
      if (this.settings.cacheEnabled) {
        await this.cache.set(
          inpaintCacheKey,
          inpaintedDataUrl,
          this.settings.cacheTtlHours * 3_600_000,
        );
      }
    }

    // --- Step 4: Overlay rendering ---
    const textSpecs: TextRenderSpec[] = regions.map((region, i): TextRenderSpec => ({
      text: translations[i] ?? region.text,
      polygon: region.polygon,
      orientation: region.orientation,
      fontFamily: this.settings.fontFamily,
      maxFontSize: this.settings.maxFontSize,
      color: this.settings.textColor,
      strokeColor: this.settings.strokeEnabled ? this.settings.strokeColor : undefined,
      strokeWidth: this.settings.strokeEnabled ? 3 : 0,
    }));

    const overlayEl = await this.overlay.attach(imageEl, inpaintedDataUrl, textSpecs);

    const result: PipelineResult = {
      imageUrl: inpaintedDataUrl,
      overlay: overlayEl,
      textRegions: regions,
      translations,
    };

    onStatus?.(imageUrl, 'done');
    return result;
  }

  private buildTextSpecs(cached: PipelineResult): TextRenderSpec[] {
    return cached.textRegions.map((region, i): TextRenderSpec => ({
      text: cached.translations[i] ?? region.text,
      polygon: region.polygon,
      orientation: region.orientation,
      fontFamily: this.settings.fontFamily,
      maxFontSize: this.settings.maxFontSize,
      color: this.settings.textColor,
      strokeColor: this.settings.strokeEnabled ? this.settings.strokeColor : undefined,
      strokeWidth: this.settings.strokeEnabled ? 3 : 0,
    }));
  }
}
