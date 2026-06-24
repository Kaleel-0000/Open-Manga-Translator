import browser from 'webextension-polyfill';
import { ExtensionMessage, ExtensionSettings, FetchImageResponse } from '@/interfaces';
import { HeuristicImageDetector } from '@/services/detector/HeuristicImageDetector';
import { createOCRProvider } from '@/services/ocr/OCRProviderRegistry';
import { createTranslationProvider } from '@/services/translator/TranslationProviderRegistry';
import { WorkerImageInpainter } from '@/services/image/WorkerImageInpainter';
import { CanvasOverlayRenderer } from '@/services/overlay/CanvasOverlayRenderer';
import { IDBCacheProvider } from '@/services/cache/IDBCacheProvider';
import { TranslationPipeline } from '@/services/pipeline/TranslationPipeline';

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------

let settings: ExtensionSettings | null = null;
let pipeline: TranslationPipeline | null = null;
const detector = new HeuristicImageDetector();
const overlay = new CanvasOverlayRenderer();
const cache = new IDBCacheProvider();
const processing = new Set<string>(); // URLs currently being processed
const processed = new Set<string>();  // URLs already done

// ----------------------------------------------------------------
// Initialization
// ----------------------------------------------------------------

async function init(): Promise<void> {
  const response = await browser.runtime.sendMessage({ type: 'GET_SETTINGS', payload: {} });
  settings = response as ExtensionSettings;

  rebuildPipeline();

  if (settings.autoTranslate) {
    observePage();
    translateVisible();
  }
}

function rebuildPipeline(): void {
  if (!settings) return;

  const ocr = createOCRProvider(settings.ocrProvider, settings.apiKeys);
  const translator = createTranslationProvider(
    settings.translationProvider,
    settings.apiKeys,
    settings.localModelEndpoint,
  );
  const inpainter = new WorkerImageInpainter();

  pipeline = new TranslationPipeline(ocr, translator, inpainter, overlay, cache, settings);
}

// ----------------------------------------------------------------
// Page observation
// ----------------------------------------------------------------

function observePage(): void {
  // Watch for dynamically added images (lazy load, SPA navigation)
  const mutationObserver = new MutationObserver((mutations) => {
    let hasNewImages = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (
          (node instanceof HTMLImageElement && detector.isComicImage(node)) ||
          (node instanceof Element && node.querySelector('img'))
        ) {
          hasNewImages = true;
        }
      }
      // Handle src attribute changes (lazy loading)
      if (
        mutation.type === 'attributes' &&
        mutation.target instanceof HTMLImageElement &&
        mutation.attributeName === 'src'
      ) {
        hasNewImages = true;
      }
    }
    if (hasNewImages && settings?.autoTranslate) {
      translateVisible();
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'data-src', 'data-lazy-src'],
  });

  // Translate images as they scroll into view
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      if (!settings?.autoTranslate) return;
      const visible = entries
        .filter((e) => e.isIntersecting)
        .map((e) => e.target)
        .filter((el): el is HTMLImageElement => el instanceof HTMLImageElement);

      for (const img of visible) {
        if (!processed.has(img.src) && !processing.has(img.src)) {
          void translateImage(img);
        }
      }
    },
    { rootMargin: '200px' }, // pre-load 200px below viewport
  );

  // Observe all current and future images
  const observeImages = () => {
    document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      if (detector.isComicImage(img)) {
        intersectionObserver.observe(img);
      }
    });
  };

  observeImages();
  new MutationObserver(observeImages).observe(document.body, {
    childList: true, subtree: true,
  });
}

// ----------------------------------------------------------------
// Translation actions
// ----------------------------------------------------------------

async function translateVisible(): Promise<void> {
  const images = detector.detect();
  const visible = images.filter((img) => isVisible(img.element));

  for (const img of visible) {
    if (!processed.has(img.resolvedUrl) && !processing.has(img.resolvedUrl)) {
      void translateImage(img.element);
    }
  }
}

async function translatePage(): Promise<void> {
  const images = detector.detect();
  for (const img of images) {
    if (!processed.has(img.resolvedUrl) && !processing.has(img.resolvedUrl)) {
      void translateImage(img.element);
    }
  }
}

async function translateImageByUrl(url: string): Promise<void> {
  const img = document.querySelector<HTMLImageElement>(`img[src="${url}"]`);
  if (img) await translateImage(img);
}

async function translateImage(imgEl: HTMLImageElement): Promise<void> {
  if (!settings || !pipeline) return;
  if (!detector.isComicImage(imgEl)) return;

  const url = imgEl.src;
  if (processed.has(url) || processing.has(url)) return;
  processing.add(url);

  try {
    // Fetch image via background service worker (CORS bypass)
    const fetchMsg: ExtensionMessage<{ url: string }> = {
      type: 'FETCH_IMAGE',
      payload: { url },
    };
    const fetchResult = await browser.runtime.sendMessage(fetchMsg) as FetchImageResponse & { error?: string };

    if (fetchResult.error) {
      throw new Error(fetchResult.error);
    }

    await pipeline.translate(
      imgEl,
      fetchResult.dataUrl,
      {
        sourceLang: settings.sourceLang,
        targetLang: settings.targetLang,
        translateSfx: settings.translateSfx,
        inpaintQuality: settings.inpaintQuality,
      },
      (imageUrl, status, detail) => {
        console.debug(`[MangaTranslate] ${imageUrl} → ${status}`, detail ?? '');
      },
    );

    processed.add(url);
    detector.markProcessed(url);
  } catch (err) {
    console.error('[MangaTranslate] Translation failed for', url, err);
  } finally {
    processing.delete(url);
  }
}

// ----------------------------------------------------------------
// Message handler
// ----------------------------------------------------------------

browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as ExtensionMessage;

  switch (msg.type) {
    case 'TRANSLATE_IMAGE': {
      const { url } = msg.payload as { url: string };
      void translateImageByUrl(url);
      break;
    }
    case 'TRANSLATE_PAGE':
      void translatePage();
      break;
    case 'TRANSLATE_VISIBLE':
      void translateVisible();
      break;
    case 'TOGGLE_OVERLAY': {
      const { url } = msg.payload as { url: string };
      const img = document.querySelector<HTMLImageElement>(`img[src="${url}"]`);
      if (img) overlay.toggle(img);
      break;
    }
    case 'SAVE_SETTINGS':
      settings = msg.payload as ExtensionSettings;
      rebuildPipeline();
      break;
    case 'CLEAR_CACHE':
      void cache.clear().then(() => {
        processed.clear();
        console.log('[MangaTranslate] Cache cleared');
      });
      break;
    default:
      break;
  }
});

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top < window.innerHeight + 200 &&
    rect.bottom > -200 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

// ----------------------------------------------------------------
// Bootstrap
// ----------------------------------------------------------------

void init();
console.log('[MangaTranslate] Content script loaded');
