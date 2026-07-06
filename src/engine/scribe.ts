/**
 * A Scribe measures and draws single glyphs. Layout and painting both go
 * through this seam, so preview, export, font rendering and the personal
 * glyph atlas all share exactly one set of metrics: what is measured is
 * what is drawn, at any scale.
 */
export interface Scribe {
  /** Advance width of a glyph in logical px (excludes letter-spacing). */
  width(ch: string): number;
  /**
   * Draw a glyph with its origin at (0,0) = baseline-left.
   * `rnd` in [0,1) lets atlas scribes pick a variant deterministically.
   */
  draw(ctx: CanvasRenderingContext2D, ch: string, color: string, rnd: number): void;
  /** Font size in logical px (baseline math and strike geometry key off this). */
  readonly sizePx: number;
}

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d')!;

export class FontScribe implements Scribe {
  readonly sizePx: number;
  private readonly font: string;
  private readonly cache = new Map<string, number>();

  constructor(family: string, sizePx: number) {
    this.sizePx = sizePx;
    this.font = `${sizePx}px "${family}", cursive`;
  }

  width(ch: string): number {
    let w = this.cache.get(ch);
    if (w === undefined) {
      measureCtx.font = this.font;
      w = measureCtx.measureText(ch).width;
      this.cache.set(ch, w);
    }
    return w;
  }

  draw(ctx: CanvasRenderingContext2D, ch: string, color: string, _rnd?: number): void {
    ctx.font = this.font;
    ctx.fillStyle = color;
    ctx.fillText(ch, 0, 0);
  }
}
