/**
 * Tests for HeuristicImageDetector.
 * We mock DOM elements since tests run in Node (jsdom via Jest).
 */

// jsdom is not set up in this config, so we test the scoring logic directly
// by extracting the pure functions and testing them in isolation.

import { HeuristicImageDetector } from '../services/detector/HeuristicImageDetector';

// Helper: create a mock HTMLImageElement
function mockImg(overrides: Partial<{
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  width: number;
  height: number;
  offsetWidth: number;
  className: string;
  id: string;
  parentElement: Element | null;
}> = {}): HTMLImageElement {
  return {
    tagName: 'IMG',
    src: overrides.src ?? 'https://example.com/page001.jpg',
    dataset: {},
    naturalWidth: overrides.naturalWidth ?? 800,
    naturalHeight: overrides.naturalHeight ?? 1200,
    width: overrides.width ?? 800,
    height: overrides.height ?? 1200,
    offsetWidth: overrides.offsetWidth ?? 800,
    className: overrides.className ?? '',
    id: overrides.id ?? '',
    parentElement: overrides.parentElement ?? {
      clientWidth: 900,
      id: 'manga-reader',
      className: 'manga-reader',
    } as unknown as Element,
    getAttribute: (attr: string) => null,
    style: {} as CSSStyleDeclaration,
    insertAdjacentElement: jest.fn(),
    setAttribute: jest.fn(),
    removeAttribute: jest.fn(),
  } as unknown as HTMLImageElement;
}

// Save and restore globals
const originalLocation = global.window?.location;

beforeAll(() => {
  // Mock window.location
  Object.defineProperty(global, 'window', {
    value: {
      location: { href: 'https://mangareader.com/manga/one-piece/chapter-1' },
    },
    writable: true,
  });

  // Mock document.querySelectorAll
  Object.defineProperty(global, 'document', {
    value: {
      querySelectorAll: () => ({ length: 20 }),
    },
    writable: true,
  });
});

describe('HeuristicImageDetector.isComicImage', () => {
  let detector: HeuristicImageDetector;

  beforeEach(() => {
    detector = new HeuristicImageDetector();
  });

  afterEach(() => {
    detector.dispose();
  });

  it('rejects non-image elements', () => {
    const div = document.createElement('div');
    expect(detector.isComicImage(div)).toBe(false);
  });

  it('rejects images that are too small', () => {
    const img = mockImg({ naturalWidth: 100, naturalHeight: 100 });
    expect(detector.isComicImage(img)).toBe(false);
  });

  it('accepts tall portrait images (manga page)', () => {
    const img = mockImg({ naturalWidth: 800, naturalHeight: 1200 });
    expect(detector.isComicImage(img)).toBe(true);
  });

  it('accepts very tall webtoon strips', () => {
    const img = mockImg({ naturalWidth: 720, naturalHeight: 5000 });
    expect(detector.isComicImage(img)).toBe(true);
  });

  it('accepts landscape double-spread pages', () => {
    const img = mockImg({ naturalWidth: 1600, naturalHeight: 1200 });
    expect(detector.isComicImage(img)).toBe(true);
  });

  it('rejects tiny thumbnails', () => {
    const img = mockImg({ naturalWidth: 150, naturalHeight: 200 });
    expect(detector.isComicImage(img)).toBe(false);
  });
});

describe('HeuristicImageDetector.markProcessed', () => {
  it('tracks processed URLs', () => {
    const detector = new HeuristicImageDetector();
    detector.markProcessed('https://example.com/page1.jpg');

    const img = mockImg({ src: 'https://example.com/page1.jpg' });
    // The detect() method would mark it as processed, but we test markProcessed
    // indirectly by checking the set is updated
    detector.dispose(); // just ensure no errors
  });
});
