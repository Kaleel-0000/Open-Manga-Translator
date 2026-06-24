import { OverlayRenderer, TextRenderSpec } from '@/interfaces';
import { BubbleTextRenderer } from '@/services/renderer/BubbleTextRenderer';

const OVERLAY_ATTR = 'data-mt-overlay-id';
const WRAPPER_CLASS = 'mt-overlay-wrapper';

let overlayCounter = 0;

/**
 * Creates a stacked overlay on comic images:
 *   [wrapper div]
 *     [original img]           (hidden when translated)
 *     [inpainted img canvas]   (background layer)
 *     [text canvas]            (text layer)
 *
 * The wrapper mirrors the image's dimensions and position.
 * The original image is never modified.
 */
export class CanvasOverlayRenderer implements OverlayRenderer {
  private readonly renderer = new BubbleTextRenderer();
  /** Map from image URL to wrapper element */
  private readonly wrappers = new Map<string, HTMLElement>();

  async attach(
    target: HTMLImageElement,
    inpaintedDataUrl: string,
    textSpecs: TextRenderSpec[],
  ): Promise<HTMLElement> {
    // Remove any existing overlay first
    this.detach(target);

    const id = String(overlayCounter++);
    target.setAttribute(OVERLAY_ATTR, id);

    const w = target.naturalWidth || target.offsetWidth;
    const h = target.naturalHeight || target.offsetHeight;

    // --- wrapper ---
    const wrapper = document.createElement('div');
    wrapper.className = WRAPPER_CLASS;
    wrapper.dataset['mtId'] = id;
    Object.assign(wrapper.style, {
      position: 'relative',
      display: 'inline-block',
      width: `${target.offsetWidth}px`,
      height: `${target.offsetHeight}px`,
    });

    // Inject shared CSS once
    injectStyles();

    // --- inpainted background image ---
    const bgImg = document.createElement('img');
    bgImg.src = inpaintedDataUrl;
    Object.assign(bgImg.style, {
      position: 'absolute',
      top: '0', left: '0',
      width: '100%', height: '100%',
      display: 'block',
    });

    // --- text canvas ---
    const textCanvas = document.createElement('canvas');
    textCanvas.width = w;
    textCanvas.height = h;
    Object.assign(textCanvas.style, {
      position: 'absolute',
      top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none',
    });

    // Render text
    await this.renderer.render(textCanvas, textSpecs, w, h);

    // Assemble
    wrapper.appendChild(bgImg);
    wrapper.appendChild(textCanvas);

    // Hide original image and insert wrapper after it
    target.style.display = 'none';
    target.insertAdjacentElement('afterend', wrapper);

    this.wrappers.set(target.src, wrapper);
    return wrapper;
  }

  detach(target: HTMLImageElement): void {
    const wrapper = this.findWrapper(target);
    if (wrapper) {
      wrapper.remove();
      target.style.display = '';
      target.removeAttribute(OVERLAY_ATTR);
      this.wrappers.delete(target.src);
    }
  }

  toggle(target: HTMLImageElement): void {
    const wrapper = this.findWrapper(target);
    if (!wrapper) return;

    const isTranslated = target.style.display === 'none';
    if (isTranslated) {
      // Show original
      target.style.display = '';
      wrapper.style.display = 'none';
    } else {
      // Show translated
      target.style.display = 'none';
      wrapper.style.display = 'inline-block';
    }
  }

  dispose(): void {
    for (const [url, wrapper] of this.wrappers) {
      wrapper.remove();
      void url; // suppress unused warning
    }
    this.wrappers.clear();
    this.renderer.dispose();
  }

  private findWrapper(target: HTMLImageElement): HTMLElement | null {
    return this.wrappers.get(target.src) ?? null;
  }
}

let stylesInjected = false;
function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .${WRAPPER_CLASS} {
      line-height: 0;
      vertical-align: bottom;
    }
    .${WRAPPER_CLASS} img {
      max-width: none !important;
    }
  `;
  document.head.appendChild(style);
}
