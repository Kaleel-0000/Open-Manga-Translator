import { BubbleTextRenderer } from '../services/renderer/BubbleTextRenderer';
import { TextRenderSpec } from '../interfaces';

// Mock canvas for Node environment
class MockCanvasRenderingContext2D {
  font = '';
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 0;
  textAlign: CanvasTextAlign = 'left';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  lineJoin: CanvasLineJoin = 'miter';
  calls: string[] = [];

  clearRect(x: number, y: number, w: number, h: number) { this.calls.push(`clearRect(${x},${y},${w},${h})`); }
  fillText(text: string, x: number, y: number) { this.calls.push(`fillText("${text}",${x},${y})`); }
  strokeText(text: string, x: number, y: number) { this.calls.push(`strokeText("${text}",${x},${y})`); }
  save() { this.calls.push('save'); }
  restore() { this.calls.push('restore'); }
  translate(x: number, y: number) { this.calls.push(`translate(${x},${y})`); }
  measureText(text: string) { return { width: text.length * 8 }; } // 8px per char estimate
}

class MockHTMLCanvasElement {
  width = 0;
  height = 0;
  private ctx = new MockCanvasRenderingContext2D();
  getContext(type: string) {
    return type === '2d' ? this.ctx : null;
  }
  get _ctx() { return this.ctx; }
}

function makeSpec(overrides: Partial<TextRenderSpec> = {}): TextRenderSpec {
  return {
    text: 'Hello!',
    polygon: {
      points: [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 60 }, { x: 10, y: 60 }],
      bounds: { x: 10, y: 10, width: 100, height: 50 },
    },
    orientation: 'horizontal',
    color: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 2,
    maxFontSize: 20,
    ...overrides,
  };
}

describe('BubbleTextRenderer', () => {
  let renderer: BubbleTextRenderer;
  let canvas: MockHTMLCanvasElement;

  beforeEach(() => {
    renderer = new BubbleTextRenderer();
    canvas = new MockHTMLCanvasElement();
  });

  afterEach(() => {
    renderer.dispose();
  });

  it('sets canvas dimensions to image size', async () => {
    await renderer.render(canvas as unknown as HTMLCanvasElement, [], 800, 1200);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(1200);
  });

  it('calls fillText for each text spec', async () => {
    const spec = makeSpec({ text: 'Test' });
    await renderer.render(canvas as unknown as HTMLCanvasElement, [spec], 800, 1200);
    const calls = canvas._ctx.calls;
    expect(calls.some((c) => c.startsWith('fillText("Test"'))).toBe(true);
  });

  it('calls strokeText when strokeWidth > 0', async () => {
    const spec = makeSpec({ strokeWidth: 3 });
    await renderer.render(canvas as unknown as HTMLCanvasElement, [spec], 800, 1200);
    expect(canvas._ctx.calls.some((c) => c.startsWith('strokeText'))).toBe(true);
  });

  it('does not call strokeText when strokeWidth is 0', async () => {
    const spec = makeSpec({ strokeWidth: 0 });
    await renderer.render(canvas as unknown as HTMLCanvasElement, [spec], 800, 1200);
    expect(canvas._ctx.calls.some((c) => c.startsWith('strokeText'))).toBe(false);
  });

  it('renders multiple specs', async () => {
    const specs = [
      makeSpec({ text: 'Line one' }),
      makeSpec({ text: 'Line two', polygon: { ...makeSpec().polygon, bounds: { x: 200, y: 200, width: 100, height: 50 } } }),
    ];
    await renderer.render(canvas as unknown as HTMLCanvasElement, specs, 800, 1200);
    const fillCalls = canvas._ctx.calls.filter((c) => c.startsWith('fillText'));
    expect(fillCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('handles vertical text orientation', async () => {
    const spec = makeSpec({ orientation: 'vertical-rl', text: 'あいう' });
    // Should not throw
    await expect(
      renderer.render(canvas as unknown as HTMLCanvasElement, [spec], 800, 1200),
    ).resolves.toBeUndefined();
  });

  it('handles empty specs array without error', async () => {
    await expect(
      renderer.render(canvas as unknown as HTMLCanvasElement, [], 800, 1200),
    ).resolves.toBeUndefined();
  });
});
