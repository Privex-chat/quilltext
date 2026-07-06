import { Doc, Settings, defaultSettings, docFromText } from '../engine/types';
import { Atlas, AtlasData, loadAtlasData } from '../engine/atlas';

export type ChangeKind = 'settings' | 'doc' | 'atlas' | 'project';
type Listener = (kind: ChangeKind) => void;

const SAMPLE_TEXT =
  'Quilltext turns anything you type into a page that looks honestly handwritten.\n' +
  'Pick a font or clone your own handwriting, tune the paper and ink, and export ' +
  'a PNG or PDF that matches this preview exactly. Try turning on mistakes in the ' +
  'Realism section: enable mistakes to add scribbled corrections.';

class Store {
  settings: Settings = defaultSettings();
  doc: Doc = docFromText(SAMPLE_TEXT);
  atlas: Atlas | null = null;
  atlasData: AtlasData | null = null;

  private subs = new Set<Listener>();
  private imgCache = new Map<string, HTMLImageElement>();

  /**
   * Decoded-image cache for the watermark. Returns the image once ready, or
   * null while it loads (kicking off a re-render on load). Keeps paint sync.
   */
  getImage(dataURL: string | null): HTMLImageElement | null {
    if (!dataURL) return null;
    const cached = this.imgCache.get(dataURL);
    if (cached) return cached.complete && cached.naturalWidth ? cached : null;
    const img = new Image();
    img.onload = () => this.emit('settings');
    img.src = dataURL;
    this.imgCache.set(dataURL, img);
    if (this.imgCache.size > 8) this.imgCache.delete(this.imgCache.keys().next().value!);
    return null;
  }

  subscribe(fn: Listener): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  emit(kind: ChangeKind): void {
    for (const fn of this.subs) fn(kind);
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    if (this.settings[key] === value) return;
    this.settings[key] = value;
    this.emit('settings');
  }

  patch(partial: Partial<Settings>): void {
    let changed = false;
    for (const k of Object.keys(partial) as (keyof Settings)[]) {
      if (this.settings[k] !== partial[k]) {
        (this.settings as unknown as Record<string, unknown>)[k] = partial[k];
        changed = true;
      }
    }
    if (changed) this.emit('settings');
  }

  replaceSettings(s: Settings): void {
    this.settings = s;
    this.emit('settings');
  }

  setDoc(doc: Doc): void {
    this.doc = doc;
    this.emit('doc');
  }

  async setAtlas(data: AtlasData | null): Promise<void> {
    this.atlasData = data;
    this.atlas = data ? await Atlas.load(data) : null;
    if (!data && this.settings.fontFamily === '@atlas') {
      this.settings.fontFamily = defaultSettings().fontFamily;
    }
    this.emit('atlas');
  }

  async init(): Promise<void> {
    const data = loadAtlasData();
    if (data) {
      try {
        this.atlas = await Atlas.load(data);
        this.atlasData = data;
      } catch {
        /* corrupt atlas: ignore, user can re-scan */
      }
    }
  }
}

export const store = new Store();
export { SAMPLE_TEXT };
