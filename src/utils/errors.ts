/**
 * Structured error types for the manga translation pipeline.
 * All errors extend MangaTranslateError for easy instanceof checks.
 */

export class MangaTranslateError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true,
  ) {
    super(message);
    this.name = 'MangaTranslateError';
  }
}

export class OCRError extends MangaTranslateError {
  constructor(message: string, public readonly provider: string) {
    super(message, 'OCR_ERROR');
    this.name = 'OCRError';
  }
}

export class TranslationError extends MangaTranslateError {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly isRateLimit = false,
  ) {
    super(message, isRateLimit ? 'RATE_LIMIT' : 'TRANSLATION_ERROR');
    this.name = 'TranslationError';
  }
}

export class InpaintError extends MangaTranslateError {
  constructor(message: string) {
    super(message, 'INPAINT_ERROR');
    this.name = 'InpaintError';
  }
}

export class NetworkError extends MangaTranslateError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class ApiKeyError extends MangaTranslateError {
  constructor(public readonly provider: string) {
    super(`Missing or invalid API key for provider: ${provider}`, 'API_KEY_ERROR', false);
    this.name = 'ApiKeyError';
  }
}

export class ImageFetchError extends MangaTranslateError {
  constructor(message: string, public readonly url: string) {
    super(message, 'IMAGE_FETCH_ERROR');
    this.name = 'ImageFetchError';
  }
}

// ----------------------------------------------------------------
// Utility: wrap fetch with timeout + better error messages
// ----------------------------------------------------------------

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new NetworkError(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw new NetworkError(`Network request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

// ----------------------------------------------------------------
// Utility: parse provider errors into structured types
// ----------------------------------------------------------------

export function parseProviderError(
  provider: string,
  status: number,
  body: string,
): MangaTranslateError {
  if (status === 401 || status === 403) return new ApiKeyError(provider);
  if (status === 429) {
    return new TranslationError(
      `Rate limit exceeded for ${provider}. Please wait before retrying.`,
      provider,
      true,
    );
  }
  if (status >= 500) {
    return new NetworkError(`${provider} server error (${status}): ${body}`, status);
  }
  return new TranslationError(`${provider} error (${status}): ${body}`, provider);
}

// ----------------------------------------------------------------
// User-facing error messages
// ----------------------------------------------------------------

export function getUserMessage(err: unknown): string {
  if (err instanceof ApiKeyError) {
    return `Missing API key for ${err.provider}. Please add it in Settings.`;
  }
  if (err instanceof TranslationError && err.isRateLimit) {
    return `Translation rate limit reached. Try a local provider like Ollama.`;
  }
  if (err instanceof OCRError) {
    return `Text detection failed. Try a different OCR provider.`;
  }
  if (err instanceof NetworkError) {
    return `Network error. Check your connection and provider settings.`;
  }
  if (err instanceof ImageFetchError) {
    return `Could not load the image for translation.`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred.';
}
