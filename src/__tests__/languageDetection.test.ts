import { detectLanguage, detectLanguageFromRegions } from '../utils/languageDetection';

describe('detectLanguage', () => {
  it('detects Japanese from Hiragana', () => {
    const result = detectLanguage('これはテストです');
    expect(result.language).toBe('ja');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('detects Korean from Hangul', () => {
    const result = detectLanguage('안녕하세요 만화');
    expect(result.language).toBe('ko');
  });

  it('detects Chinese from CJK ideographs without kana', () => {
    const result = detectLanguage('你好世界漫画');
    expect(result.language).toBe('zh');
  });

  it('falls back to English for ASCII text', () => {
    const result = detectLanguage('Hello world comic');
    expect(result.language).toBe('en');
  });

  it('returns low confidence for empty string', () => {
    const result = detectLanguage('');
    expect(result.confidence).toBeLessThan(0.3);
  });

  it('detects Arabic script', () => {
    const result = detectLanguage('مرحبا بالعالم');
    expect(result.language).toBe('ar');
  });
});

describe('detectLanguageFromRegions', () => {
  it('aggregates text from multiple regions', () => {
    const result = detectLanguageFromRegions(['こんにちは', 'ありがとう', 'さようなら']);
    expect(result.language).toBe('ja');
  });

  it('handles empty array', () => {
    const result = detectLanguageFromRegions([]);
    expect(result.language).toBe('en');
  });
});
