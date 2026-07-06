import { Scribe, FontScribe } from './scribe';

/**
 * Personal handwriting atlas: glyph images extracted from a scanned template
 * sheet, packed into one sprite sheet. Rendering picks a variant per
 * occurrence (seeded), tints it with the ink color, and draws it like a font
 * glyph, so layout/pagination logic doesn't know atlases exist.
 */
export interface AtlasGlyph {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Horizontal advance, sheet units. */
  advance: number;
  /** y of glyph-box top relative to the baseline (negative above), sheet units. */
  bearingY: number;
}

export interface AtlasData {
  version: 1;
  name: string;
  createdAt: number;
  /** Sheet units that correspond to one em of rendered text. */
  unitH: number;
  spaceAdvance: number;
  glyphs: Record<string, AtlasGlyph[]>;
  /** PNG data URL; black ink on transparency. */
  sheet: string;
}

const STORAGE_KEY = 'quilltext.atlas';

export class Atlas {
  private readonly tinted = new Map<string, HTMLCanvasElement>();

  private constructor(
    readonly data: AtlasData,
    private readonly sheet: HTMLCanvasElement
  ) {}

  static async load(data: AtlasData): Promise<Atlas> {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Could not load handwriting sheet.'));
      img.src = data.sheet;
    });
    const sheet = document.createElement('canvas');
    sheet.width = img.naturalWidth;
    sheet.height = img.naturalHeight;
    sheet.getContext('2d')!.drawImage(img, 0, 0);
    return new Atlas(data, sheet);
  }

  glyph(ch: string, rnd: number): AtlasGlyph | undefined {
    const variants = this.data.glyphs[ch];
    if (!variants?.length) return undefined;
    return variants[Math.min(variants.length - 1, Math.floor(rnd * variants.length))];
  }

  has(ch: string): boolean {
    return !!this.data.glyphs[ch]?.length;
  }

  /** Sheet with every glyph filled in `color`, cached per color. */
  tintedSheet(color: string): HTMLCanvasElement {
    let c = this.tinted.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = this.sheet.width;
      c.height = this.sheet.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(this.sheet, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, c.width, c.height);
      this.tinted.set(color, c);
      if (this.tinted.size > 12) this.tinted.delete(this.tinted.keys().next().value!);
    }
    return c;
  }
}

export class AtlasScribe implements Scribe {
  readonly sizePx: number;
  private readonly k: number;

  constructor(
    private readonly atlas: Atlas,
    sizePx: number,
    private readonly fallback: FontScribe
  ) {
    this.sizePx = sizePx;
    this.k = sizePx / atlas.data.unitH;
  }

  width(ch: string): number {
    if (ch === ' ') return this.atlas.data.spaceAdvance * this.k;
    const variants = this.atlas.data.glyphs[ch];
    if (!variants?.length) return this.fallback.width(ch);
    return variants[0].advance * this.k;
  }

  draw(ctx: CanvasRenderingContext2D, ch: string, color: string, rnd: number): void {
    const g = this.atlas.glyph(ch, rnd);
    if (!g) {
      this.fallback.draw(ctx, ch, color, rnd);
      return;
    }
    const sheet = this.atlas.tintedSheet(color);
    ctx.drawImage(sheet, g.x, g.y, g.w, g.h, 0, g.bearingY * this.k, g.w * this.k, g.h * this.k);
  }
}

export function loadAtlasData(): AtlasData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AtlasData;
    return data.version === 1 && data.sheet ? data : null;
  } catch {
    return null;
  }
}

export function saveAtlasData(data: AtlasData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearAtlasData(): void {
  localStorage.removeItem(STORAGE_KEY);
}
