import { OCRProvider, TranslationProvider, ImageInpainter, OverlayRenderer, CacheProvider, PipelineOptions, PipelineResult, ExtensionSettings } from '@/interfaces';
export type PipelineEventCallback = (imageUrl: string, status: 'ocr' | 'translating' | 'rendering' | 'done' | 'error', detail?: string) => void;
/**
 * TranslationPipeline
 *
 * The central coordinator for translating a single comic image.
 * It is stateless with respect to images — call translate() any number of times.
 *
 * Dependency-injected: swap any provider without touching this class.
 */
export declare class TranslationPipeline {
    private readonly ocr;
    private readonly translator;
    private readonly inpainter;
    private readonly overlay;
    private readonly cache;
    private readonly settings;
    constructor(ocr: OCRProvider, translator: TranslationProvider, inpainter: ImageInpainter, overlay: OverlayRenderer, cache: CacheProvider, settings: ExtensionSettings);
    translate(imageEl: HTMLImageElement, imageDataUrl: string, options: PipelineOptions, onStatus?: PipelineEventCallback): Promise<PipelineResult>;
    private buildTextSpecs;
}
//# sourceMappingURL=TranslationPipeline.d.ts.map