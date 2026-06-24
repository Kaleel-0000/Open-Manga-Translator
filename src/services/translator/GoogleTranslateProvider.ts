import {
  TranslationProvider, TranslationRequest, TranslationResponse, LanguagePair,
} from '@/interfaces';

interface GTResponse {
  data: {
    translations: { translatedText: string; detectedSourceLanguage?: string }[];
  };
}

/**
 * Google Cloud Translation v2 (Basic) provider.
 */
export class GoogleTranslateProvider implements TranslationProvider {
  readonly id = 'google-translate';
  readonly displayName = 'Google Translate';
  readonly supportsOffline = false;

  constructor(private readonly apiKey: string) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async translate(req: TranslationRequest): Promise<TranslationResponse> {
    const start = Date.now();

    const params = new URLSearchParams({ key: this.apiKey, target: req.targetLang });
    if (req.sourceLang !== 'auto') params.set('source', req.sourceLang);
    for (const text of req.texts) params.append('q', text);

    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?${params}`,
    );
    if (!res.ok) throw new Error(`Google Translate error: ${res.status}`);

    const data: GTResponse = await res.json();
    const translations = data.data.translations.map((t) => t.translatedText);
    const detectedSourceLang = data.data.translations[0]?.detectedSourceLanguage;

    return { translations, detectedSourceLang, processingMs: Date.now() - start };
  }

  async getSupportedLanguages(): Promise<LanguagePair[]> {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2/languages?key=${this.apiKey}&target=en`,
    );
    if (!res.ok) return [];
    const data: { data: { languages: { language: string; name: string }[] } } =
      await res.json();
    return data.data.languages.map((l) => ({ code: l.language, name: l.name }));
  }

  dispose(): void {}
}
