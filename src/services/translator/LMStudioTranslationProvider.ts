import {
  TranslationProvider, TranslationRequest, TranslationResponse, LanguagePair,
} from '@/interfaces';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
  fr: 'French', es: 'Spanish', de: 'German', pt: 'Portuguese',
};

/**
 * LM Studio local model provider.
 * Uses the OpenAI-compatible REST API that LM Studio exposes on localhost:1234.
 * Any model loaded in LM Studio is supported.
 */
export class LMStudioTranslationProvider implements TranslationProvider {
  readonly id = 'lm-studio';
  readonly displayName = 'LM Studio (Local)';
  readonly supportsOffline = true;

  constructor(
    private readonly endpoint: string = 'http://localhost:1234',
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/v1/models`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async translate(req: TranslationRequest): Promise<TranslationResponse> {
    const start = Date.now();
    const sourceName = req.sourceLang === 'auto'
      ? 'the source language'
      : (LANGUAGE_NAMES[req.sourceLang] ?? req.sourceLang);
    const targetName = LANGUAGE_NAMES[req.targetLang] ?? req.targetLang;

    const numberedTexts = req.texts.map((t, i) => `${i + 1}. ${t}`).join('\n');

    const res = await fetch(`${this.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // LM Studio uses whatever model is currently loaded
        model: 'local-model',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `You are a manga/comic translator. Translate from ${sourceName} to ${targetName}. Respond ONLY with JSON: {"translations": ["t1", "t2"]}`,
          },
          { role: 'user', content: numberedTexts },
        ],
      }),
    });

    if (!res.ok) throw new Error(`LM Studio error: ${res.status}`);

    const data: { choices: [{ message: { content: string } }] } = await res.json();
    const content = data.choices[0]?.message.content ?? '{}';
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed: { translations?: string[] } = JSON.parse(cleaned);

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
