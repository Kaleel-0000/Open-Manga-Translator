import { DetectedComicImage, ImageDetector } from '@/interfaces';
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
export declare class HeuristicImageDetector implements ImageDetector {
    private processedUrls;
    detect(root?: Element): DetectedComicImage[];
    isComicImage(el: Element): boolean;
    markProcessed(url: string): void;
    dispose(): void;
    private resolveImageUrl;
    private guessComicType;
    private findContainer;
}
//# sourceMappingURL=HeuristicImageDetector.d.ts.map