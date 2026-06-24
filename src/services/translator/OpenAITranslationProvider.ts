import {
  TranslationProvider, TranslationRequest, TranslationResponse, LanguagePair,
} from '@/interfaces';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ja: 'Japanese', zh: 'Chinese (Simplified)', ko: 'Korean',
  fr: 'French', es: 'Spanish', de: 'German', pt: 'Portuguese',
  it: 'Italian', ru: 'Russian', ar: 'Arabic', vi: 'Vietnamese',
};

/**
 * OpenAI translation provider.
 * Uses GPT-4o-mini by default (fast + cheap for translation tasks).
 */
export class OpenAITranslationProvider implements TranslationProvider {
  readonly id = 'openai';
  readonly displayName = 'OpenAI GPT';
  readonly supportsOffline = false;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'gpt-4o-mini',
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async translate(req: TranslationRequest): Promise<TranslationResponse> {
    const start = Date.now();
    const sourceName = req.sourceLang === 'auto'
      ? 'the source language'
      : (LANGUAGE_NAMES[req.sourceLang] ?? req.sourceLang);
    const targetName = LANGUAGE_NAMES[req.targetLang] ?? req.targetLang;

    const numberedTexts = req.texts.map((t, i) => `${i + 1}. ${t}`).join('\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a professional manga/comic translator. 
Translate each numbered item from ${sourceName} to ${targetName}.
Preserve tone, emotion, and style appropriate for comic dialogue.
Respond ONLY with a JSON object: { "translations": ["t1", "t2", ...] }`,
          },
          { role: 'user', content: numberedTexts },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message: string } };
      throw new Error(`OpenAI error: ${err.error?.message ?? res.status}`);
    }

    const data: { choices: [{ message: { content: string } }] } = await res.json();
    const content = data.choices[0]?.message.content ?? '{}';
    const parsed: { translations?: string[] } = JSON.parse(content);

    return {
      translations: parsed.translations ?? req.texts,
      processingMs: Date.now() - start,
    };
  }

  async getSupportedLanguages(): Promise<LanguagePair[]> {
    return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({ code, name }));
  }

  dispose(): void {}
}
