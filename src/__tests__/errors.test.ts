import {
  OCRError, TranslationError, ApiKeyError, NetworkError,
  parseProviderError, getUserMessage, MangaTranslateError,
} from '../utils/errors';

describe('Error types', () => {
  it('OCRError has correct properties', () => {
    const err = new OCRError('Tesseract failed', 'tesseract');
    expect(err).toBeInstanceOf(MangaTranslateError);
    expect(err).toBeInstanceOf(OCRError);
    expect(err.code).toBe('OCR_ERROR');
    expect(err.provider).toBe('tesseract');
    expect(err.recoverable).toBe(true);
  });

  it('ApiKeyError is not recoverable', () => {
    const err = new ApiKeyError('openai');
    expect(err.recoverable).toBe(false);
    expect(err.code).toBe('API_KEY_ERROR');
  });

  it('rate limit TranslationError has correct code', () => {
    const err = new TranslationError('Too many requests', 'deepl', true);
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.isRateLimit).toBe(true);
  });
});

describe('parseProviderError', () => {
  it('returns ApiKeyError for 401', () => {
    const err = parseProviderError('openai', 401, 'Unauthorized');
    expect(err).toBeInstanceOf(ApiKeyError);
  });

  it('returns ApiKeyError for 403', () => {
    const err = parseProviderError('deepl', 403, 'Forbidden');
    expect(err).toBeInstanceOf(ApiKeyError);
  });

  it('returns rate-limit TranslationError for 429', () => {
    const err = parseProviderError('openai', 429, 'Rate limited');
    expect(err).toBeInstanceOf(TranslationError);
    expect((err as TranslationError).isRateLimit).toBe(true);
  });

  it('returns NetworkError for 500+', () => {
    const err = parseProviderError('google', 503, 'Service unavailable');
    expect(err).toBeInstanceOf(NetworkError);
    expect((err as NetworkError).statusCode).toBe(503);
  });

  it('returns TranslationError for other codes', () => {
    const err = parseProviderError('deepl', 400, 'Bad request');
    expect(err).toBeInstanceOf(TranslationError);
  });
});

describe('getUserMessage', () => {
  it('gives helpful message for missing API key', () => {
    const msg = getUserMessage(new ApiKeyError('openai'));
    expect(msg).toMatch(/API key/i);
    expect(msg).toMatch(/openai/i);
    expect(msg).toMatch(/Settings/i);
  });

  it('suggests local provider for rate limits', () => {
    const msg = getUserMessage(new TranslationError('limited', 'openai', true));
    expect(msg).toMatch(/Ollama/i);
  });

  it('handles plain Error', () => {
    const msg = getUserMessage(new Error('Something broke'));
    expect(msg).toBe('Something broke');
  });

  it('handles unknown errors', () => {
    const msg = getUserMessage('raw string error');
    expect(msg).toBe('An unexpected error occurred.');
  });
});
