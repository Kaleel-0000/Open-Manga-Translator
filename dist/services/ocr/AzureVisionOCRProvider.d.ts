import { OCRProvider, OCRResult } from '@/interfaces';
/**
 * Azure Computer Vision (Read API v3.2) OCR provider.
 * Excellent accuracy on Japanese/Korean/Chinese manga.
 */
export declare class AzureVisionOCRProvider implements OCRProvider {
    private readonly endpoint;
    private readonly apiKey;
    readonly id = "azure-vision";
    readonly displayName = "Azure Computer Vision";
    constructor(endpoint: string, // e.g. https://<region>.api.cognitive.microsoft.com
    apiKey: string);
    isAvailable(): Promise<boolean>;
    recognize(imageUrl: string): Promise<OCRResult>;
    dispose(): void;
    private pollResult;
    private parseResult;
    private detectOrientation;
}
//# sourceMappingURL=AzureVisionOCRProvider.d.ts.map