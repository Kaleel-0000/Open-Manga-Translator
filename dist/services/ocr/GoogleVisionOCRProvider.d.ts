import { OCRProvider, OCRResult } from '@/interfaces';
/**
 * Google Cloud Vision OCR provider.
 * Requires a GCP API key stored in extension settings.
 */
export declare class GoogleVisionOCRProvider implements OCRProvider {
    private readonly apiKey;
    readonly id = "google-vision";
    readonly displayName = "Google Cloud Vision";
    constructor(apiKey: string);
    isAvailable(): Promise<boolean>;
    recognize(imageUrl: string): Promise<OCRResult>;
    dispose(): void;
    private detectOrientation;
    private blobToBase64;
}
//# sourceMappingURL=GoogleVisionOCRProvider.d.ts.map