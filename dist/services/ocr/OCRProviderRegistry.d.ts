import { OCRProvider } from '@/interfaces';
export interface OCRProviderMeta {
    id: string;
    displayName: string;
    requiresApiKey: boolean;
    supportsOffline: boolean;
    apiKeyLabel?: string;
    extraFields?: {
        key: string;
        label: string;
        placeholder: string;
    }[];
}
export declare const OCR_PROVIDER_REGISTRY: OCRProviderMeta[];
export declare function createOCRProvider(id: string, apiKeys: Record<string, string>): OCRProvider;
//# sourceMappingURL=OCRProviderRegistry.d.ts.map