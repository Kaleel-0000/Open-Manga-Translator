import {
  TranslationProvider, TranslationRequest, TranslationResponse, LanguagePair,
} from '@/interfaces';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
  fr: 'French', es: 'Spanish', de: 'German', pt: 'Portuguese',
  it: 'Italian', ru: 'Russian', ar: 'Arabic', vi: 'Vietnamese',
  th: 'Thai', id: 'Indonesian',
};

/**
 * Ollama local LLM translation provider.
 *
 * Uses any Ollama-hosted model (e.g., llama3, mistral, qwen) to translate.
 * Provides effectively unlimited translations when running locally.
 *
 * The model name is configurable; recommended: "qwen2.5:7b" or "llama3.1:8b"
 * for multilingual capability.
 */
export class OllamaTranslationProvider implements TranslationProvider {
  readonly id = 'ollama';
  readonly displayName = 'Ollama (Local LLM)';
  readonly supportsOffline = true;

  constructor(
    private readonly endpoint: string = 'http://localhost:11434',
    private readonly model: string = 'qwen2.5:7b',
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return false;
      const data: { models?: { name: string }[] } = await res.json();
      // Check if our desired model is available
      return data.models?.some((m) => m.name.startsWith(this.model.split(':')[0] ?? ''))
        ?? false;
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

    // Batch all texts into a single prompt for efficiency
    const numberedTexts = req.texts
      .map((t, i) => `${i + 1}. ${t}`)
      .join('\n');

    const systemPrompt = `You are a professional manga/comic translator.
Translate each numbered item from ${sourceName} to ${targetName}.
Preserve the tone, emotion, and nuance appropriate for comic dialogue.
Sound effects (onomatopoeia) should be adapted culturally, not literally.
Respond ONLY with a JSON array of translated strings in the same order.
Example: ["Translation 1", "Translation 2"]`;

    const userPrompt = `Translate these manga texts:\n${numberedTexts}`;

    const body = {
      model: this.model,
      prompt: `${systemPrompt}\n\nUser: ${userPrompt}\nAssistant:`,
      stream: false,
      options: { temperature: 0.2, top_p: 0.9 },
    };

    const res = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

    const data: { response: string } = await res.json();
    const translations = this.parseResponse(data.response, req.texts.length);

    return { translations, processingMs: Date.now() - start };
  }

  async getSupportedLanguages(): Promise<LanguagePair[]> {
    return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({ code, name }));
  }

  dispose(): void {}

  private parseResponse(raw: string, expectedCount: number): string[] {
    // Strip markdown fences if present
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length === expectedCount) {
        return parsed.map(String);
      }
    } catch {
      // fall through to line-by-line parsing
    }

    // Fallback: parse "1. text" format
    const lines = raw.split('\n').filter((l) => /^\d+\./.test(l.trim()));
    if (lines.length === expectedCount) {
      return lines.map((l) => l.replace(/^\d+\.\s*/, '').trim());
    }

    // Last resort: return raw text split by newlines
    console.warn('Ollama: could not parse structured response, using raw lines');
    return raw.split('\n').filter(Boolean).slice(0, expectedCount);
  }
}
