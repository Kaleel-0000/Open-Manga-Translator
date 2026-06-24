import {
  TranslationProvider, TranslationRequest, TranslationResponse, LanguagePair,
} from '@/interfaces';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
  fr: 'French', es: 'Spanish', de: 'German', pt: 'Portuguese',
  it: 'Italian', ru: 'Russian', ar: 'Arabic', vi: 'Vietnamese',
};

/**
 * Anthropic Claude translation provider.
 * Uses claude-haiku for high-speed, cost-efficient translation.
 */
export class ClaudeTranslationProvider implements TranslationProvider {
  readonly id = 'claude';
  readonly displayName = 'Claude (Anthropic)';
  readonly supportsOffline = false;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'claude-haiku-4-5-20251001',
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async translate(req: TranslationRequest): Promise<TranslationResponse> {
    const start = Date.now();
    const sourceName = req.sourceLang === 'auto'
      ? 'the detected source language'
      : (LANGUAGE_NAMES[req.sourceLang] ?? req.sourceLang);
    const targetName = LANGUAGE_NAMES[req.targetLang] ?? req.targetLang;

    const numberedTexts = req.texts.map((t, i) => `${i + 1}. ${t}`).join('\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        system: `You are a professional manga and comic translator with deep knowledge of Japanese, Korean, and Chinese pop culture. Translate each numbered item from ${sourceName} to ${targetName}. Preserve the emotional tone and style appropriate for comic dialogue. Adapt idioms and cultural references naturally. Respond ONLY with a JSON object in this exact format: {"translations": ["translation1", "translation2", ...]}`,
        messages: [
          { role: 'user', content: `Translate these texts:\n${numberedTexts}` },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message: string } };
      throw new Error(`Claude API error: ${err.error?.message ?? res.status}`);
    }

    const data: { content: [{ type: string; text: string }] } = await res.json();
    const text = data.content[0]?.text ?? '{}';

    // Strip any markdown fences
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
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
