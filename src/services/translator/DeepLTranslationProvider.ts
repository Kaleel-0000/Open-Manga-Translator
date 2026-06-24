import {
  TranslationProvider, TranslationRequest, TranslationResponse, LanguagePair,
} from '@/interfaces';

interface DeepLResponse {
  translations: { detected_source_language: string; text: string }[];
}

/**
 * DeepL translation provider.
 * Supports both Free (api-free.deepl.com) and Pro (api.deepl.com) endpoints.
 */
export class DeepLTranslationProvider implements TranslationProvider {
  readonly id = 'deepl';
  readonly displayName = 'DeepL';
  readonly supportsOffline = false;

  private readonly endpoint: string;

  constructor(
    private readonly apiKey: string,
    isPro = false,
  ) {
    this.endpoint = isPro
      ? 'https://api.deepl.com/v2/translate'
      : 'https://api-free.deepl.com/v2/translate';
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async translate(req: TranslationRequest): Promise<TranslationResponse> {
    const start = Date.now();

    const body = new URLSearchParams();
    body.append('auth_key', this.apiKey);
    body.append('target_lang', req.targetLang.toUpperCase());
    if (req.sourceLang !== 'auto') {
      body.append('source_lang', req.sourceLang.toUpperCase());
    }
    for (const text of req.texts) {
      body.append('text', text);
    }

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`DeepL error: ${res.status}`);
    }

    const data: DeepLResponse = await res.json();
    return {
      translations: data.translations.map((t) => t.text),
      detectedSourceLang: data.translations[0]?.detected_source_language,
      processingMs: Date.now() - start,
    };
  }

  async getSupportedLanguages(): Promise<LanguagePair[]> {
    const res = await fetch(
      `${this.endpoint.replace('/translate', '/languages')}?auth_key=${this.apiKey}`,
    );
    if (!res.ok) return [];
    const data: { language: string; name: string }[] = await res.json();
    return data.map((l) => ({ code: l.language.toLowerCase(), name: l.name }));
  }

  dispose(): void {}
}
