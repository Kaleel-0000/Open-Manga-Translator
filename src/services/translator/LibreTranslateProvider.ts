import {
  TranslationProvider, TranslationRequest, TranslationResponse, LanguagePair,
} from '@/interfaces';

interface LibreTranslateLang { code: string; name: string }

/**
 * LibreTranslate provider.
 *
 * Supports both the public instance (rate-limited) and self-hosted instances.
 * A self-hosted instance on localhost provides effectively unlimited translations.
 *
 * Default endpoint: http://localhost:5000 (local) or https://libretranslate.com
 */
export class LibreTranslateProvider implements TranslationProvider {
  readonly id = 'libretranslate';
  readonly displayName = 'LibreTranslate';
  readonly supportsOffline = true; // when running locally

  constructor(
    private readonly endpoint: string = 'http://localhost:5000',
    private readonly apiKey?: string,
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/languages`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async translate(req: TranslationRequest): Promise<TranslationResponse> {
    const start = Date.now();
    const translations: string[] = [];

    // LibreTranslate translates one text at a time (batch via Promise.all)
    const results = await Promise.all(
      req.texts.map((text) => this.translateOne(text, req.sourceLang, req.targetLang)),
    );

    translations.push(...results);
    return { translations, processingMs: Date.now() - start };
  }

  async getSupportedLanguages(): Promise<LanguagePair[]> {
    const res = await fetch(`${this.endpoint}/languages`);
    const data: LibreTranslateLang[] = await res.json();
    return data.map((l) => ({ code: l.code, name: l.name }));
  }

  dispose(): void {}

  private async translateOne(
    text: string,
    source: string,
    target: string,
  ): Promise<string> {
    const body: Record<string, string> = {
      q: text,
      source: source === 'auto' ? 'auto' : source,
      target,
      format: 'text',
    };
    if (this.apiKey) body['api_key'] = this.apiKey;

    const res = await fetch(`${this.endpoint}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`LibreTranslate error ${res.status}: ${err}`);
    }

    const data: { translatedText: string; detectedLanguage?: { language: string } } =
      await res.json();
    return data.translatedText;
  }
}
