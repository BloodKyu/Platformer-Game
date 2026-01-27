import { ANIMATION_MANIFEST, ASSET_ROOT } from '../constants';
import { AnimationKey } from '../types';

export class AssetManager {
  private static cache: Map<string, HTMLImageElement> = new Map();
  private static loadedCounts: Map<AnimationKey, number> = new Map();
  
  static init() {
    // Start loading all assets defined in the manifest
    Object.entries(ANIMATION_MANIFEST).forEach(([key, config]) => {
      const animKey = key as AnimationKey;
      for (let i = 0; i < config.count; i++) {
        // Calculate the actual frame number in the filename
        const frameNum = (config.startAt || 0) + i;
        
        // Handle Zero Padding (e.g. 1 -> "001")
        const frameStr = config.pad 
          ? frameNum.toString().padStart(config.pad, '0') 
          : frameNum.toString();

        const path = `${ASSET_ROOT}/${config.folder}/${config.prefix}${frameStr}.png`;
        this.loadImage(animKey, i, path);
      }
    });
  }

  private static loadImage(animKey: AnimationKey, index: number, path: string) {
    const img = new Image();
    img.src = path;
    img.onload = () => {
      this.cache.set(this.getCacheKey(animKey, index), img);
      const current = this.loadedCounts.get(animKey) || 0;
      this.loadedCounts.set(animKey, current + 1);
    };
    img.onerror = () => {
      // Silently fail - game will fallback to procedural rendering for missing files
      // console.warn(`Failed to load sprite: ${path}`);
    };
  }

  private static getCacheKey(animKey: AnimationKey, index: number): string {
    return `${animKey}_${index}`;
  }

  /**
   * Returns the image for a specific animation frame, or undefined if not loaded.
   */
  static getFrame(animKey: AnimationKey, index: number): HTMLImageElement | undefined {
    // Handle looping or clamping based on manifest
    const config = ANIMATION_MANIFEST[animKey];
    let actualIndex = index;
    
    if (index >= config.count) {
      if (config.loop) {
        actualIndex = index % config.count;
      } else {
        actualIndex = config.count - 1;
      }
    }

    return this.cache.get(this.getCacheKey(animKey, actualIndex));
  }

  /**
   * Checks if an animation has at least one frame loaded to determine render mode.
   */
  static hasAssets(animKey: AnimationKey): boolean {
    return (this.loadedCounts.get(animKey) || 0) > 0;
  }
}