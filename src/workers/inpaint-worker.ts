/**
 * Inpainting Web Worker
 *
 * Runs text-removal inpainting in a worker thread to avoid blocking the UI.
 * Two strategies:
 *   - 'fast': simple average-color fill from bubble edge pixels
 *   - 'quality': Telea-style fast marching method implemented in JS/Canvas
 */

import type { InpaintRequest, InpaintResult, Polygon } from '@/interfaces';

// ----------------------------------------------------------------
// Worker message handling
// ----------------------------------------------------------------

self.onmessage = async (e: MessageEvent<InpaintRequest>) => {
  try {
    const result = await inpaint(e.data);
    self.postMessage(result);
  } catch (err) {
    self.postMessage({ error: String(err) });
  }
};

// ----------------------------------------------------------------
// Main inpaint function
// ----------------------------------------------------------------

async function inpaint(req: InpaintRequest): Promise<InpaintResult> {
  const start = Date.now();

  const img = await loadImage(req.imageDataUrl);
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  for (const polygon of req.regions) {
    if (req.quality === 'quality') {
      inpaintRegionQuality(imageData, polygon);
    } else {
      inpaintRegionFast(imageData, polygon);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const dataUrl = await blobToDataUrl(blob);

  return { imageDataUrl: dataUrl, processingMs: Date.now() - start };
}

// ----------------------------------------------------------------
// Fast strategy: fill with averaged border pixel color
// ----------------------------------------------------------------

function inpaintRegionFast(imageData: ImageData, polygon: Polygon): void {
  const { x, y, width, height } = polygon.bounds;
  const { data, width: W } = imageData;

  // Sample border pixels around the polygon to get background color
  const borderPixels: number[][] = [];
  const margin = 4;

  for (let bx = x - margin; bx <= x + width + margin; bx++) {
    samplePixel(data, W, bx, y - margin, borderPixels);
    samplePixel(data, W, bx, y + height + margin, borderPixels);
  }
  for (let by = y - margin; by <= y + height + margin; by++) {
    samplePixel(data, W, x - margin, by, borderPixels);
    samplePixel(data, W, x + width + margin, by, borderPixels);
  }

  if (borderPixels.length === 0) {
    // Fallback: white fill
    fillRect(imageData, x, y, width, height, [255, 255, 255, 255]);
    return;
  }

  // Average the border pixel colors
  const avg = borderPixels.reduce(
    (acc, px) => [acc[0]! + px[0]!, acc[1]! + px[1]!, acc[2]! + px[2]!, 255],
    [0, 0, 0, 0],
  ).map((v, i) => i < 3 ? Math.round(v / borderPixels.length) : v);

  fillRect(imageData, x, y, width, height, avg as [number, number, number, number]);
}

// ----------------------------------------------------------------
// Quality strategy: simplified Telea inpainting (FMM-based)
// ----------------------------------------------------------------

function inpaintRegionQuality(imageData: ImageData, polygon: Polygon): void {
  const { x, y, width, height } = polygon.bounds;
  const { data, width: W, height: H } = imageData;

  // Create a mask for pixels that need inpainting
  const mask = createMask(W, H, polygon);

  // Build narrow band (border of mask)
  const narrowBand = new Set<number>();
  for (let py = Math.max(0, y - 1); py <= Math.min(H - 1, y + height + 1); py++) {
    for (let px = Math.max(0, x - 1); px <= Math.min(W - 1, x + width + 1); px++) {
      const idx = py * W + px;
      if (!mask[idx] && hasInpaintNeighbor(mask, W, H, px, py)) {
        narrowBand.add(idx);
      }
    }
  }

  // Propagate: for each masked pixel, average from known neighbors
  // Uses a simplified approach (full FMM is very complex to implement in JS)
  const inpaintOrder = buildInpaintOrder(mask, W, H, polygon);

  for (const idx of inpaintOrder) {
    const px = idx % W;
    const py = Math.floor(idx / W);
    const neighbors = getKnownNeighbors(data, mask, W, H, px, py, 5);

    if (neighbors.length > 0) {
      const avg = averageColor(neighbors);
      const base = idx * 4;
      data[base] = avg[0]!;
      data[base + 1] = avg[1]!;
      data[base + 2] = avg[2]!;
      data[base + 3] = 255;
      mask[idx] = false; // mark as known
    }
  }
}

// ----------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------

function createMask(W: number, H: number, polygon: Polygon): boolean[] {
  const mask = new Array<boolean>(W * H).fill(false);
  const { x, y, width, height } = polygon.bounds;

  for (let py = Math.max(0, y); py <= Math.min(H - 1, y + height); py++) {
    for (let px = Math.max(0, x); px <= Math.min(W - 1, x + width); px++) {
      if (pointInPolygon(px, py, polygon)) {
        mask[py * W + px] = true;
      }
    }
  }
  return mask;
}

function pointInPolygon(px: number, py: number, polygon: Polygon): boolean {
  let inside = false;
  const pts = polygon.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]!.x, yi = pts[i]!.y;
    const xj = pts[j]!.x, yj = pts[j]!.y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function buildInpaintOrder(
  mask: boolean[], W: number, H: number, polygon: Polygon,
): number[] {
  const { x, y, width, height } = polygon.bounds;
  const order: number[] = [];

  // Spiral inward from edges (simple row-major order for now)
  for (let py = Math.max(0, y); py <= Math.min(H - 1, y + height); py++) {
    for (let px = Math.max(0, x); px <= Math.min(W - 1, x + width); px++) {
      if (mask[py * W + px]) {
        order.push(py * W + px);
      }
    }
  }
  return order;
}

function hasInpaintNeighbor(
  mask: boolean[], W: number, H: number, px: number, py: number,
): boolean {
  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  return neighbors.some(([dx, dy]) => {
    const nx = px + dx!, ny = py + dy!;
    return nx >= 0 && nx < W && ny >= 0 && ny < H && mask[ny * W + nx];
  });
}

function getKnownNeighbors(
  data: Uint8ClampedArray, mask: boolean[],
  W: number, H: number,
  px: number, py: number, radius: number,
): [number, number, number][] {
  const result: [number, number, number][] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = px + dx, ny = py + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const idx = ny * W + nx;
      if (!mask[idx]) {
        const base = idx * 4;
        result.push([data[base]!, data[base + 1]!, data[base + 2]!]);
      }
    }
  }
  return result;
}

function averageColor(colors: [number, number, number][]): [number, number, number] {
  const sum = colors.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]] as [number, number, number], [0, 0, 0] as [number, number, number]);
  return [
    Math.round(sum[0] / colors.length),
    Math.round(sum[1] / colors.length),
    Math.round(sum[2] / colors.length),
  ];
}

function fillRect(
  imageData: ImageData,
  x: number, y: number, width: number, height: number,
  color: [number, number, number, number],
): void {
  const { data, width: W, height: H } = imageData;
  for (let py = Math.max(0, y); py < Math.min(H, y + height); py++) {
    for (let px = Math.max(0, x); px < Math.min(W, x + width); px++) {
      const base = (py * W + px) * 4;
      data[base] = color[0]!;
      data[base + 1] = color[1]!;
      data[base + 2] = color[2]!;
      data[base + 3] = color[3]!;
    }
  }
}

function samplePixel(
  data: Uint8ClampedArray, W: number,
  x: number, y: number,
  out: number[][],
): void {
  if (x < 0 || y < 0 || x >= W) return;
  const idx = (y * W + x) * 4;
  out.push([data[idx]!, data[idx + 1]!, data[idx + 2]!]);
}

async function loadImage(dataUrl: string): Promise<ImageBitmap> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
