export interface Point {
    x: number;
    y: number;
}
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface Polygon {
    points: Point[];
    /** Axis-aligned bounding rect around the polygon */
    bounds: BoundingBox;
}
export type TextOrientation = 'horizontal' | 'vertical-rl' | 'vertical-lr';
export interface TextRegion {
    /** Detected text string */
    text: string;
    /** Tight polygon around the text */
    polygon: Polygon;
    /** Confidence score 0–1 */
    confidence: number;
    /** Reading orientation */
    orientation: TextOrientation;
    /** Detected script/language hint (e.g. 'ja', 'zh', 'ko') */
    languageHint?: string;
    /** Whether this region looks like a sound effect */
    isSfx?: boolean;
}
export interface OCRResult {
    regions: TextRegion[];
    /** Full-image language guess */
    detectedLanguage?: string;
    /** Processing time in ms */
    processingMs: number;
}
export interface OCRProvider {
    readonly id: string;
    readonly displayName: string;
    /** Returns true when the provider is ready (models loaded, keys set, etc.) */
    isAvailable(): Promise<boolean>;
    /** Run OCR on an image given as a data-URL or Blob URL */
    recognize(imageUrl: string, lang?: string): Promise<OCRResult>;
    /** Clean up resources (e.g. terminate workers) */
    dispose(): void;
}
export interface TranslationRequest {
    texts: string[];
    sourceLang: string;
    targetLang: string;
    /** Optional: surrounding context for LLM-based providers */
    context?: string;
}
export interface TranslationResponse {
    translations: string[];
    detectedSourceLang?: string;
    processingMs: number;
}
export interface TranslationProvider {
    readonly id: string;
    readonly displayName: string;
    readonly supportsOffline: boolean;
    isAvailable(): Promise<boolean>;
    translate(req: TranslationRequest): Promise<TranslationResponse>;
    getSupportedLanguages(): Promise<LanguagePair[]>;
    dispose(): void;
}
export interface LanguagePair {
    code: string;
    name: string;
}
export type ComicType = 'manga' | 'manhwa' | 'manhua' | 'webtoon' | 'comic' | 'unknown';
export interface DetectedComicImage {
    element: HTMLImageElement;
    /** Resolved image URL (may differ from src due to lazy loading) */
    resolvedUrl: string;
    comicType: ComicType;
    /** Natural pixel dimensions */
    naturalWidth: number;
    naturalHeight: number;
    /** Whether this image has already been processed */
    isProcessed: boolean;
}
export interface ImageDetector {
    /** Scan the document for comic images */
    detect(root?: Element): DetectedComicImage[];
    /** Returns true if a single element is likely a comic image */
    isComicImage(el: Element): boolean;
    dispose(): void;
}
export interface InpaintRequest {
    /** Source image as data URL */
    imageDataUrl: string;
    /** Regions to erase */
    regions: Polygon[];
    /** Quality: 'fast' uses simple fill, 'quality' uses inpainting algorithm */
    quality: 'fast' | 'quality';
}
export interface InpaintResult {
    /** Inpainted image as data URL */
    imageDataUrl: string;
    processingMs: number;
}
export interface ImageInpainter {
    inpaint(req: InpaintRequest): Promise<InpaintResult>;
    isAvailable(): Promise<boolean>;
    dispose(): void;
}
export interface TextRenderSpec {
    text: string;
    polygon: Polygon;
    orientation: TextOrientation;
    /** Font family override */
    fontFamily?: string;
    /** Max font size in px */
    maxFontSize?: number;
    /** Text color */
    color?: string;
    /** Outline/stroke color */
    strokeColor?: string;
    /** Stroke width in px */
    strokeWidth?: number;
}
export interface TextRenderer {
    /**
     * Render translated texts onto a canvas that exactly overlays the source image.
     * Returns the canvas element.
     */
    render(canvas: HTMLCanvasElement, specs: TextRenderSpec[], imageWidth: number, imageHeight: number): Promise<void>;
    dispose(): void;
}
export interface OverlayRenderer {
    /**
     * Attach a translated-content overlay to a comic image element.
     * Returns the overlay element so callers can remove it later.
     */
    attach(target: HTMLImageElement, inpaintedDataUrl: string, textSpecs: TextRenderSpec[]): Promise<HTMLElement>;
    detach(target: HTMLImageElement): void;
    toggle(target: HTMLImageElement): void;
    dispose(): void;
}
export interface CacheProvider {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
    /** Returns approximate usage in bytes */
    size(): Promise<number>;
}
export interface PipelineOptions {
    sourceLang: string;
    targetLang: string;
    translateSfx: boolean;
    inpaintQuality: 'fast' | 'quality';
}
export interface PipelineResult {
    imageUrl: string;
    /** The final overlay element attached to the DOM */
    overlay: HTMLElement;
    textRegions: TextRegion[];
    translations: string[];
}
export interface ExtensionSettings {
    enabled: boolean;
    targetLang: string;
    sourceLang: string;
    ocrProvider: string;
    translationProvider: string;
    apiKeys: Record<string, string>;
    localModelEndpoint: string;
    fontFamily: string;
    maxFontSize: number;
    strokeEnabled: boolean;
    strokeColor: string;
    textColor: string;
    inpaintQuality: 'fast' | 'quality';
    theme: 'auto' | 'light' | 'dark';
    translateSfx: boolean;
    cacheEnabled: boolean;
    cacheTtlHours: number;
    autoTranslate: boolean;
}
export declare const DEFAULT_SETTINGS: ExtensionSettings;
export type MessageType = 'TRANSLATE_IMAGE' | 'TRANSLATE_PAGE' | 'TRANSLATE_VISIBLE' | 'TOGGLE_OVERLAY' | 'GET_SETTINGS' | 'SAVE_SETTINGS' | 'FETCH_IMAGE' | 'OCR_REQUEST' | 'OCR_RESPONSE' | 'TRANSLATION_REQUEST' | 'TRANSLATION_RESPONSE' | 'PIPELINE_STATUS' | 'CLEAR_CACHE' | 'GET_STATS';
export interface ExtensionMessage<T = unknown> {
    type: MessageType;
    payload: T;
    requestId?: string;
}
export interface PipelineStatusPayload {
    imageUrl: string;
    status: 'queued' | 'ocr' | 'translating' | 'rendering' | 'done' | 'error';
    error?: string;
    progress?: number;
}
export interface FetchImagePayload {
    url: string;
}
export interface FetchImageResponse {
    dataUrl: string;
    mimeType: string;
}
//# sourceMappingURL=index.d.ts.map