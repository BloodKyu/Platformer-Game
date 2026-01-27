import { ANIMATION_MANIFEST, ASSET_ROOT } from '../constants';
import { AnimationKey } from '../types';

const DB_NAME = 'YuiFoundryDB';
const STORE_NAME = 'assets'; // Key: "ANIM_KEY:INDEX", Value: Blob

export class AssetManager {
  private static cache: Map<string, HTMLImageElement> = new Map();
  private static loadedCounts: Map<AnimationKey, number> = new Map();
  private static failedAnims: Set<AnimationKey> = new Set();
  public static errorLog: string[] = [];
  public static currentRoot: string = ASSET_ROOT;

  static async init() {
    // 1. First, try to load any user-uploaded assets from IndexedDB
    await this.hydrateFromDB();

    // 2. Then load any missing assets from the network
    this.reload(this.currentRoot);
  }

  static setRoot(newRoot: string) {
    this.currentRoot = newRoot;
    // We do NOT clear the whole cache here, because we want to keep IDB assets.
    // We only trigger a reload to fetch missing items from the new URL.
    this.reload(newRoot);
  }

  static reload(root: string) {
    console.log(`[AssetManager] Checking assets... Root: ${root}`);

    Object.entries(ANIMATION_MANIFEST).forEach(([key, config]) => {
      const animKey = key as AnimationKey;

      // CRITICAL: If we already have assets (e.g. from IDB), SKIP network load.
      if (this.hasAssets(animKey)) {
          // console.log(`[AssetManager] Skipping ${animKey} (Already loaded locally)`);
          return;
      }

      for (let i = 0; i < config.count; i++) {
        const frameNum = (config.startAt || 0) + i;
        const frameStr = config.pad 
          ? frameNum.toString().padStart(config.pad, '0') 
          : frameNum.toString();

        const cleanRoot = root.endsWith('/') ? root.slice(0, -1) : root;
        const path = `${cleanRoot}/${config.folder}/${config.prefix}${frameStr}.png`;
        
        this.loadImage(animKey, i, path);
      }
    });
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
              
              // Track max indices to fix Manifest counts
              const maxIndices: Record<string, number> = {};

              request.onsuccess = (e) => {
                  const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
                  if (cursor) {
                      const key = cursor.key as string; // "RUN:0"
                      const blob = cursor.value as Blob;
                      
                      // Parse Key
                      const [animKey, indexStr] = key.split(':');
                      const index = parseInt(indexStr);
                      const aKey = animKey as AnimationKey;
                      
                      // Track max index found
                      if (maxIndices[aKey] === undefined || index > maxIndices[aKey]) {
                          maxIndices[aKey] = index;
                      }

                      // Load into Memory
                      const objectUrl = URL.createObjectURL(blob);
                      const img = new Image();
                      img.src = objectUrl;
                      img.onload = () => {
                          this.cache.set(this.getCacheKey(aKey, index), img);
                          // Update counts
                          const current = this.loadedCounts.get(aKey) || 0;
                          this.loadedCounts.set(aKey, current + 1);
                      };

                      cursor.continue();
                  } else {
                      // CRITICAL FIX: Update Manifest counts so the game knows to play all frames
                      Object.entries(maxIndices).forEach(([key, maxIndex]) => {
                          const aKey = key as AnimationKey;
                          if (ANIMATION_MANIFEST[aKey]) {
                              // count is index + 1
                              ANIMATION_MANIFEST[aKey].count = maxIndex + 1;
                              console.log(`[AssetManager] Hydrated ${key}: ${maxIndex + 1} frames`);
                          }
                      });
                      
                      console.log('[AssetManager] Database Hydration Complete');
                      resolve();
                  }
              };
              request.onerror = () => resolve(); // Fail gracefully
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
          const db = await this.openDB();
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).clear();
          
          // Clear memory too
          this.cache.clear();
          this.loadedCounts.clear();
          this.failedAnims.clear();
          this.errorLog = [];
          
          // Reset Manifest to defaults
          // (Requires reload really, but we force it)
          console.log("[AssetManager] Cache Purged");
          window.location.reload(); 
      } catch (err) {
          console.error("Failed to purge DB", err);
      }
  }

  // --- FILE HANDLING ---

  static loadFromFiles(animKey: AnimationKey, files: FileList) {
      // 1. Sort files
      const sortedFiles = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
      
      console.log(`[AssetManager] Manual upload for ${animKey}: ${sortedFiles.length} files`);

      // 2. Clear existing cache for this animation in memory (so we can replace it)
      this.loadedCounts.set(animKey, 0);
      this.failedAnims.delete(animKey);

      // 3. Load & Persist
      sortedFiles.forEach((file, index) => {
          const objectUrl = URL.createObjectURL(file);
          const img = new Image();
          img.src = objectUrl;
          
          img.onload = () => {
              this.cache.set(this.getCacheKey(animKey, index), img);
              const current = this.loadedCounts.get(animKey) || 0;
              this.loadedCounts.set(animKey, current + 1);
              console.log(`[AssetManager] Loaded & Saved: ${animKey} frame ${index}`);
          };

          // PERSISTENCE MAGIC
          this.saveToDB(animKey, index, file);
      });

      // Update Manifest count immediately
      if (ANIMATION_MANIFEST[animKey]) {
          ANIMATION_MANIFEST[animKey].count = sortedFiles.length;
      }
  }

  private static loadImage(animKey: AnimationKey, index: number, path: string) {
    // If we already have this specific frame (e.g. from IDB), don't fetch
    if (this.cache.has(this.getCacheKey(animKey, index))) return;

    const img = new Image();
    img.src = path;
    
    img.onload = () => {
      // console.log(`[AssetManager] LOADED (Net): ${animKey} frame ${index}`);
      this.cache.set(this.getCacheKey(animKey, index), img);
      const current = this.loadedCounts.get(animKey) || 0;
      this.loadedCounts.set(animKey, current + 1);
    };
    
    img.onerror = () => {
      if (!this.failedAnims.has(animKey)) {
        const msg = `MISSING: ${path}`;
        // console.warn(`[AssetManager] ${msg}`);
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