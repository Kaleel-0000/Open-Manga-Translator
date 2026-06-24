import { DetectedComicImage, ImageDetector, ComicType } from '@/interfaces';

// Minimum dimensions for a comic image (px)
const MIN_WIDTH = 300;
const MIN_HEIGHT = 200;

// Aspect ratio ranges
const MANGA_ASPECT_MIN = 0.5;   // taller than wide (portrait page)
const MANGA_ASPECT_MAX = 2.5;   // wider than tall (double-spread)
const WEBTOON_ASPECT_MAX = 0.4; // very tall strip

// URL path patterns common on comic sites
const COMIC_URL_PATTERNS = [
  /chapter/i, /manga/i, /manhwa/i, /manhua/i, /comic/i, /webtoon/i,
  /episode/i, /read/i, /scan/i, /page/i,
];

// Container class/id patterns
const CONTAINER_PATTERNS = [
  /reader/i, /viewer/i, /manga/i, /comic/i, /chapter/i,
  /page/i, /webtoon/i, /image/i,
];

/**
 * Heuristic-based comic image detector.
 *
 * Detection criteria (scored):
 * 1. Image is large enough (hard minimum)
 * 2. Aspect ratio matches comic formats
 * 3. Page URL suggests a comic site
 * 4. Image URL path suggests comic content
 * 5. Image is inside a recognized reader container
 * 6. Image is isolated (not part of a grid of small images)
 */
export class HeuristicImageDetector implements ImageDetector {
  private processedUrls = new Set<string>();

  detect(root: Element = document.documentElement): DetectedComicImage[] {
    const images = root.querySelectorAll<HTMLImageElement>('img');
    const results: DetectedComicImage[] = [];

    for (const img of images) {
      if (this.isComicImage(img)) {
        const url = this.resolveImageUrl(img);
        results.push({
          element: img,
          resolvedUrl: url,
          comicType: this.guessComicType(img),
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          isProcessed: this.processedUrls.has(url),
        });
      }
    }

    return results;
  }

  isComicImage(el: Element): boolean {
    if (!(el instanceof HTMLImageElement)) return false;

    const img = el;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    // Hard size filter
    if (w < MIN_WIDTH || h < MIN_HEIGHT) return false;

    let score = 0;

    // Aspect ratio score
    const aspect = w / h;
    if (aspect >= MANGA_ASPECT_MIN && aspect <= MANGA_ASPECT_MAX) score += 2;

    // Webtoon strip pattern (very tall)
    if (aspect < WEBTOON_ASPECT_MAX) score += 2;

    // URL signals
    const pageUrl = window.location.href;
    if (COMIC_URL_PATTERNS.some((p) => p.test(pageUrl))) score += 1;

    const imgUrl = img.src || img.dataset['src'] || '';
    if (COMIC_URL_PATTERNS.some((p) => p.test(imgUrl))) score += 2;

    // Container signals
    const container = this.findContainer(img);
    if (container) score += 2;

    // Isolation: if image is one of very few on page, likely main content
    const totalImages = document.querySelectorAll('img').length;
    if (totalImages <= 50) score += 1;

    // CSS isolation: image takes up most of its parent's width
    const parentWidth = img.parentElement?.clientWidth ?? 0;
    if (parentWidth > 0 && w / parentWidth > 0.6) score += 1;

    return score >= 3;
  }

  markProcessed(url: string): void {
    this.processedUrls.add(url);
  }

  dispose(): void {
    this.processedUrls.clear();
  }

  // ----------------------------------------------------------------
  private resolveImageUrl(img: HTMLImageElement): string {
    // Handle lazy-loaded images
    return (
      img.src ||
      img.dataset['src'] ||
      img.dataset['lazySrc'] ||
      img.dataset['original'] ||
      img.getAttribute('data-cfsrc') ||
      ''
    );
  }

  private guessComicType(img: HTMLImageElement): ComicType {
    const url = (img.src + window.location.href).toLowerCase();
    const h = img.naturalHeight || img.height;
    const w = img.naturalWidth || img.width;

    if (url.includes('webtoon') || url.includes('lezhin') || h / w > 3) {
      return 'webtoon';
    }
    if (url.includes('manhwa') || url.includes('toptoon')) return 'manhwa';
    if (url.includes('manhua') || url.includes('bilibili')) return 'manhua';
    if (url.includes('manga')) return 'manga';
    if (url.includes('comic')) return 'comic';
    return 'unknown';
  }

  private findContainer(img: HTMLImageElement): Element | null {
    let el: Element | null = img;
    for (let depth = 0; depth < 6; depth++) {
      el = el?.parentElement ?? null;
      if (!el) break;
      const id = (el.id + ' ' + el.className).toLowerCase();
      if (CONTAINER_PATTERNS.some((p) => p.test(id))) return el;
    }
    return null;
  }
}
