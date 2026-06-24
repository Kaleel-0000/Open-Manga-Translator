import { TranslationProvider, TranslationRequest, TranslationResponse, LanguagePair } from '@/interfaces';
/**
 * DeepL translation provider.
 * Supports both Free (api-free.deepl.com) and Pro (api.deepl.com) endpoints.
 */
export declare class DeepLTranslationProvider implements TranslationProvider {
    private readonly apiKey;
    readonly id = "deepl";
    readonly displayName = "DeepL";
    readonly supportsOffline = false;
    private readonly endpoint;
    constructor(apiKey: string, isPro?: boolean);
    isAvailable(): Promise<boolean>;
    translate(req: TranslationRequest): Promise<TranslationResponse>;
    getSupportedLanguages(): Promise<LanguagePair[]>;
    dispose(): void;
}
//# sourceMappingURL=DeepLTranslationProvider.d.ts.map