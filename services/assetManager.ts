import { ANIMATION_MANIFEST, ASSET_ROOT } from '../constants';
import { AnimationKey } from '../types';

export class AssetManager {
  private static cache: Map<string, HTMLImageElement> = new Map();
  private static loadedCounts: Map<AnimationKey, number> = new Map();
  private static failedAnims: Set<AnimationKey> = new Set();
  public static errorLog: string[] = [];
  public static currentRoot: string = ASSET_ROOT;

  static init() {
    this.reload(this.currentRoot);
  }

  static setRoot(newRoot: string) {
    this.currentRoot = newRoot;
    this.reload(newRoot);
  }

  static reload(root: string) {
    this.cache.clear();
    this.loadedCounts.clear();
    this.failedAnims.clear();
    this.errorLog = [];
    console.log(`[AssetManager] Reloading assets from: ${root}`);

    Object.entries(ANIMATION_MANIFEST).forEach(([key, config]) => {
      const animKey = key as AnimationKey;
      for (let i = 0; i < config.count; i++) {
        const frameNum = (config.startAt || 0) + i;
        const frameStr = config.pad 
          ? frameNum.toString().padStart(config.pad, '0') 
          : frameNum.toString();

        // Clean up double slashes if user puts trailing slash
        const cleanRoot = root.endsWith('/') ? root.slice(0, -1) : root;
        const path = `${cleanRoot}/${config.folder}/${config.prefix}${frameStr}.png`;
        
        this.loadImage(animKey, i, path);
      }
    });
  }

  private static loadImage(animKey: AnimationKey, index: number, path: string) {
    const img = new Image();
    img.src = path;
    
    img.onload = () => {
      // If one frame loads, we consider the animation valid
      console.log(`[AssetManager] LOADED: ${animKey} frame ${index}`);
      this.cache.set(this.getCacheKey(animKey, index), img);
      const current = this.loadedCounts.get(animKey) || 0;
      this.loadedCounts.set(animKey, current + 1);
    };
    
    img.onerror = () => {
      // Only log the first failure per animation type to avoid spam
      if (!this.failedAnims.has(animKey)) {
        const msg = `MISSING: ${path} (Using Procedural)`;
        console.warn(`[AssetManager] ${msg}`);
        this.errorLog.push(msg);
        this.failedAnims.add(animKey);
      }
    };
  }

  private static getCacheKey(animKey: AnimationKey, index: number): string {
    return `${animKey}_${index}`;
  }

  static getFrame(animKey: AnimationKey, index: number): HTMLImageElement | undefined {
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

  static hasAssets(animKey: AnimationKey): boolean {
    return (this.loadedCounts.get(animKey) || 0) > 0;
  }
}