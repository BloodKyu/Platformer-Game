import { ANIMATION_MANIFEST, ASSET_ROOT } from '../constants';
import { AnimationKey } from '../types';

const DB_NAME = 'YuiFoundryDB';
const STORE_NAME = 'assets'; // Key: "ANIM_KEY:INDEX", Value: Blob
const VERSION_KEY = 'YUI_ASSET_VERSION';

export class AssetManager {
  private static cache: Map<string, HTMLImageElement> = new Map();
  private static loadedCounts: Map<AnimationKey, number> = new Map();
  private static failedAnims: Set<AnimationKey> = new Set();
  public static errorLog: string[] = [];
  public static currentRoot: string = ASSET_ROOT;

  static async init() {
    await this.hydrateFromDB();
    this.reload(this.currentRoot);
  }

  static setRoot(newRoot: string) {
    this.currentRoot = newRoot;
    this.reload(newRoot);
  }

  static reload(root: string) {
    const v = this.getVersion();
    console.log(`[AssetManager] Checking assets... Root: ${root} (Version: ${v})`);

    Object.entries(ANIMATION_MANIFEST).forEach(([key, config]) => {
      const animKey = key as AnimationKey;
      if (this.hasAssets(animKey)) return;

      for (let i = 0; i < config.count; i++) {
        const frameNum = (config.startAt || 0) + i;
        const frameStr = config.pad 
          ? frameNum.toString().padStart(config.pad, '0') 
          : frameNum.toString();

        const cleanRoot = root.endsWith('/') ? root.slice(0, -1) : root;
        const path = `${cleanRoot}/${config.folder}/${config.prefix}${frameStr}.png`;
        
        this.loadImageWithRetry(animKey, i, path);
      }
    });
  }

  // --- SMART LOADING WITH RETRY ---

  private static loadImageWithRetry(animKey: AnimationKey, index: number, originalPath: string) {
      if (this.cache.has(this.getCacheKey(animKey, index))) return;

      // Append Version Tag to force browser to ignore cache if version changed
      const suffix = `?v=${this.getVersion()}`;

      const attempts: { url: string; crossOrigin: string | undefined }[] = [];

      // 1. Original Path + Version
      // We use 'anonymous' to support CORS on Canvas. 
      // If GitHub Raw fails, it usually means the file is missing (404).
      attempts.push({ url: originalPath + suffix, crossOrigin: 'anonymous' });

      // REMOVED: CDN Auto-Conversion
      // We are deliberately removing the fallback to jsDelivr here.
      // If the file is deleted on GitHub, we want it to FAIL in the game,
      // not be rescued by a stale cache on the CDN.

      // 2. Case Sensitivity Fallback (Common issue on Linux/GitHub)
      attempts.push({ url: originalPath.replace('.png', '.PNG') + suffix, crossOrigin: 'anonymous' });

      // 3. Lowercase Fallback
      attempts.push({ url: this.toLowerCaseFilename(originalPath) + suffix, crossOrigin: 'anonymous' });

      // 4. No CORS (Last Resort - might taint canvas but shows image)
      attempts.push({ url: originalPath + suffix, crossOrigin: undefined });

      this.executeLoadChain(animKey, index, attempts, 0);
  }

  private static executeLoadChain(animKey: AnimationKey, index: number, attempts: any[], attemptIdx: number) {
      if (attemptIdx >= attempts.length) {
          const msg = `FAILED: ${animKey} #${index}. Asset not found after ${attempts.length} attempts.`;
          console.warn(`[AssetManager] ${msg}`);
          return;
      }

      const { url, crossOrigin } = attempts[attemptIdx];
      
      const img = new Image();
      if (crossOrigin) img.crossOrigin = crossOrigin;
      img.src = url;

      img.onload = () => {
          this.cache.set(this.getCacheKey(animKey, index), img);
          const current = this.loadedCounts.get(animKey) || 0;
          this.loadedCounts.set(animKey, current + 1);
          this.failedAnims.delete(animKey);
      };

      img.onerror = () => {
          this.executeLoadChain(animKey, index, attempts, attemptIdx + 1);
      };
  }

  // --- HELPERS ---

  private static getVersion(): string {
      return localStorage.getItem(VERSION_KEY) || '1';
  }

  private static bumpVersion() {
      const newVersion = Date.now().toString();
      localStorage.setItem(VERSION_KEY, newVersion);
      console.log(`[AssetManager] Version bumped to: ${newVersion}`);
  }

  private static toLowerCaseFilename(urlStr: string): string {
      try {
          const lastSlash = urlStr.lastIndexOf('/');
          if (lastSlash === -1) return urlStr;
          const path = urlStr.substring(0, lastSlash + 1);
          const file = urlStr.substring(lastSlash + 1);
          return path + file.toLowerCase();
      } catch (e) { return urlStr; }
  }

  // --- INDEXED DB SUPPORT ---

  private static openDB(): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, 1);
          request.onupgradeneeded = (e) => {
              const db = (e.target as IDBOpenDBRequest).result;
              if (!db.objectStoreNames.contains(STORE_NAME)) {
                  db.createObjectStore(STORE_NAME);
              }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
      });
  }

  private static async hydrateFromDB() {
      try {
          const db = await this.openDB();
          return new Promise<void>((resolve) => {
              const tx = db.transaction(STORE_NAME, 'readonly');
              const store = tx.objectStore(STORE_NAME);
              const request = store.openCursor();
              const maxIndices: Record<string, number> = {};

              request.onsuccess = (e) => {
                  const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
                  if (cursor) {
                      const key = cursor.key as string;
                      const blob = cursor.value as Blob;
                      const [animKey, indexStr] = key.split(':');
                      const index = parseInt(indexStr);
                      const aKey = animKey as AnimationKey;
                      
                      if (maxIndices[aKey] === undefined || index > maxIndices[aKey]) {
                          maxIndices[aKey] = index;
                      }

                      const objectUrl = URL.createObjectURL(blob);
                      const img = new Image();
                      img.src = objectUrl;
                      img.onload = () => {
                          this.cache.set(this.getCacheKey(aKey, index), img);
                          const current = this.loadedCounts.get(aKey) || 0;
                          this.loadedCounts.set(aKey, current + 1);
                      };

                      cursor.continue();
                  } else {
                      Object.entries(maxIndices).forEach(([key, maxIndex]) => {
                          const aKey = key as AnimationKey;
                          if (ANIMATION_MANIFEST[aKey]) {
                              ANIMATION_MANIFEST[aKey].count = maxIndex + 1;
                              console.log(`[AssetManager] Hydrated ${key}: ${maxIndex + 1} frames`);
                          }
                      });
                      resolve();
                  }
              };
              request.onerror = () => resolve();
          });
      } catch (err) {
          console.warn("[AssetManager] IDB not available", err);
      }
  }

  private static async saveToDB(animKey: AnimationKey, index: number, blob: Blob) {
      try {
          const db = await this.openDB();
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put(blob, `${animKey}:${index}`);
      } catch (err) {
          console.error("Failed to save to DB", err);
      }
  }

  static async purgeCache() {
      try {
          console.log("[AssetManager] Purging cache...");
          const db = await this.openDB();
          
          await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(STORE_NAME, 'readwrite');
              const store = tx.objectStore(STORE_NAME);
              const request = store.clear();
              
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
              tx.onabort = () => reject(new Error("Transaction aborted"));
          });

          // Bump Version to invalidate browser/CDN cache
          this.bumpVersion();

          // Clear Memory
          this.cache.clear();
          this.loadedCounts.clear();
          this.failedAnims.clear();
          this.errorLog = [];
          
          console.log("[AssetManager] Cache cleared. Re-fetching assets...");
          
          // Trigger hot reload of assets
          this.reload(this.currentRoot);
          
      } catch (err) {
          console.error("[AssetManager] Failed to purge DB", err);
      }
  }

  static loadFromFiles(animKey: AnimationKey, files: FileList) {
      const sortedFiles = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
      this.loadedCounts.set(animKey, 0);
      this.failedAnims.delete(animKey);

      sortedFiles.forEach((file, index) => {
          const objectUrl = URL.createObjectURL(file);
          const img = new Image();
          img.src = objectUrl;
          img.onload = () => {
              this.cache.set(this.getCacheKey(animKey, index), img);
              const current = this.loadedCounts.get(animKey) || 0;
              this.loadedCounts.set(animKey, current + 1);
          };
          this.saveToDB(animKey, index, file);
      });

      if (ANIMATION_MANIFEST[animKey]) {
          ANIMATION_MANIFEST[animKey].count = sortedFiles.length;
      }
  }

  private static getCacheKey(animKey: AnimationKey, index: number): string {
    return `${animKey}_${index}`;
  }

  static getFrame(animKey: AnimationKey, index: number): HTMLImageElement | undefined {
    const config = ANIMATION_MANIFEST[animKey];
    let actualIndex = index;
    if (index >= config.count) {
      actualIndex = config.loop ? index % config.count : config.count - 1;
    }
    return this.cache.get(this.getCacheKey(animKey, actualIndex));
  }

  static hasAssets(animKey: AnimationKey): boolean {
    return (this.loadedCounts.get(animKey) || 0) > 0;
  }
}