import { TranslationProvider, TranslationRequest, TranslationResponse, LanguagePair } from '@/interfaces';
/**
 * Anthropic Claude translation provider.
 * Uses claude-haiku for high-speed, cost-efficient translation.
 */
export declare class ClaudeTranslationProvider implements TranslationProvider {
    private readonly apiKey;
    private readonly model;
    readonly id = "claude";
    readonly displayName = "Claude (Anthropic)";
    readonly supportsOffline = false;
    constructor(apiKey: string, model?: string);
    isAvailable(): Promise<boolean>;
    translate(req: TranslationRequest): Promise<TranslationResponse>;
    getSupportedLanguages(): Promise<LanguagePair[]>;
    dispose(): void;
}
//# sourceMappingURL=ClaudeTranslationProvider.d.ts.map