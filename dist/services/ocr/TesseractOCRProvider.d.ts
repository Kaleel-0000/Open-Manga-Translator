import { OCRProvider, OCRResult } from '@/interfaces';
/**
 * Tesseract.js OCR provider.
 *
 * Runs entirely in-browser with no network calls.
 * Language data is downloaded once and cached by Tesseract.
 */
export declare class TesseractOCRProvider implements OCRProvider {
    readonly id = "tesseract";
    readonly displayName = "Tesseract.js (Offline)";
    private worker;
    private initPromise;
    private init;
    isAvailable(): Promise<boolean>;
    recognize(imageUrl: string, _lang?: string): Promise<OCRResult>;
    dispose(): void;
    private detectOrientation;
    private guessLanguage;
    /**
     * Merge individual word regions that are on the same visual line
     * into a single region with concatenated text.
     */
    private mergeIntoLines;
}
//# sourceMappingURL=TesseractOCRProvider.d.ts.map