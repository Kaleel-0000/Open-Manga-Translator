/**
 * Lightweight client-side language detection based on Unicode script analysis.
 * Used as a fallback when OCR providers do not return a language hint.
 * No network calls required.
 */

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  script: string;
}

interface ScriptRange {
  start: number;
  end: number;
  script: string;
  language: string;
  weight: number;
}

const SCRIPT_RANGES: ScriptRange[] = [
  { start: 0x3040, end: 0x309F, script: 'Hiragana',             language: 'ja', weight: 3 },
  { start: 0x30A0, end: 0x30FF, script: 'Katakana',             language: 'ja', weight: 3 },
  { start: 0x31F0, end: 0x31FF, script: 'Katakana Ext',         language: 'ja', weight: 2 },
  { start: 0xAC00, end: 0xD7AF, script: 'Hangul Syllables',     language: 'ko', weight: 3 },
  { start: 0x1100, end: 0x11FF, script: 'Hangul Jamo',          language: 'ko', weight: 2 },
  { start: 0x4E00, end: 0x9FFF, script: 'CJK Unified',         language: 'zh', weight: 1 },
  { start: 0x3400, end: 0x4DBF, script: 'CJK Ext A',           language: 'zh', weight: 1 },
  { start: 0x0600, end: 0x06FF, script: 'Arabic',               language: 'ar', weight: 3 },
  { start: 0x0E00, end: 0x0E7F, script: 'Thai',                 language: 'th', weight: 3 },
  { start: 0x0400, end: 0x04FF, script: 'Cyrillic',             language: 'ru', weight: 3 },
];

export function detectLanguage(text: string): LanguageDetectionResult {
  if (!text || text.trim().length === 0) {
    return { language: 'en', confidence: 0.1, script: 'Unknown' };
  }

  const scores: Map<string, { score: number; script: string }> = new Map();
  let totalChars = 0;

  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if (cp < 0x00C0) continue;
    totalChars++;

    for (const range of SCRIPT_RANGES) {
      if (cp >= range.start && cp <= range.end) {
        const key = range.language;
        const prev = scores.get(key) ?? { score: 0, script: range.script };
        scores.set(key, { score: prev.score + range.weight, script: range.script });
        break;
      }
    }
  }

  if (scores.size === 0) {
    return { language: 'en', confidence: 0.5, script: 'Latin' };
  }

  let bestLang = 'en';
  let bestScore = 0;
  let bestScript = 'Latin';

  for (const [lang, { score, script }] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
      bestScript = script;
    }
  }

  if (bestLang === 'zh' && (scores.get('ja')?.score ?? 0) > 0) {
    bestLang = 'ja';
    bestScript = 'Hiragana/Katakana';
  }

  const confidence = Math.min(0.95, bestScore / Math.max(totalChars, 1));
  return { language: bestLang, confidence, script: bestScript };
}

export function detectLanguageFromRegions(texts: string[]): LanguageDetectionResult {
  return detectLanguage(texts.join(' '));
}

export function languageToTesseractLang(lang: string): string {
  const MAP: Record<string, string> = {
    ja: 'jpn+jpn_vert', zh: 'chi_sim+chi_tra', ko: 'kor',
    en: 'eng', fr: 'fra', de: 'deu', es: 'spa',
    pt: 'por', ru: 'rus', ar: 'ara', th: 'tha', vi: 'vie',
  };
  return MAP[lang] ?? 'eng';
}
