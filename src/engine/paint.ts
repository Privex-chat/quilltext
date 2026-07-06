import { Settings } from './types';
import { Geometry, PageLayout, PlacedToken, baselineY } from './layout';
import { Scribe } from './scribe';
import { derive, spread, Rng } from './rng';

/** Decoded resources paint needs but can't load synchronously. */
export interface RenderResources {
  logoImage: HTMLImageElement | null;
}
const NO_RES: RenderResources = { logoImage: null };

/** Paint one page. All coordinates are logical px; `scale` maps them to device px. */
export function paintPage(
  canvas: HTMLCanvasElement,
  page: PageLayout,
  pageIdx: number,
  geom: Geometry,
  s: Settings,
  scribe: Scribe,
  scale: number,
  res: RenderResources = NO_RES
): void {
  canvas.width = Math.round(geom.pageW * scale);
  canvas.height = Math.round(geom.pageH * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textBaseline = 'alphabetic';

  paintPaper(ctx, geom, s, pageIdx, res);
  paintText(ctx, page, pageIdx, geom, s, scribe);
  if (s.footer) paintFooter(ctx, geom, s, scribe);
}

/** The cover page shares paper painting but has its own composition. */
export function paintCoverPage(
  canvas: HTMLCanvasElement,
  geom: Geometry,
  s: Settings,
  scribe: Scribe,
  scale: number,
  res: RenderResources = NO_RES
): void {
  canvas.width = Math.round(geom.pageW * scale);
  canvas.height = Math.round(geom.pageH * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textBaseline = 'alphabetic';

  paintPaper(ctx, geom, s, -1, res);

  const hwFont = s.fontFamily === '@atlas' ? 'Homemade Apple' : s.fontFamily;
  const titleFont = s.coverFont || hwFont;
  const bodyFont = s.coverFont || hwFont;
  const color = s.coverColor || s.inkColor;
  const px = scribe.sizePx;
  const cx = geom.pageW / 2;

  ctx.fillStyle = color;
  ctx.font = `${px * 2.1}px "${titleFont}", cursive`;
  ctx.textAlign = 'center';
  ctx.fillText(s.coverTitle || 'Assignment', cx, geom.pageH * 0.24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - 150, geom.pageH * 0.24 + 16);
  ctx.lineTo(cx + 150, geom.pageH * 0.24 + 16);
  ctx.stroke();

  ctx.font = `${px * 1.05}px "${bodyFont}", cursive`;
  ctx.textAlign = 'left';
  const left = geom.pageW * 0.18;
  const right = geom.pageW * 0.82;
  const fields = s.coverFields.length ? s.coverFields : ['Name', 'Date'];
  let y = geom.pageH * 0.38;
  const step = Math.min(geom.pitch * 1.9, (geom.pageH * 0.5) / fields.length);
  for (const f of fields) {
    ctx.fillText(f, left, y);
    ctx.beginPath();
    ctx.moveTo(left + 120, y + 3);
    ctx.lineTo(right, y + 3);
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
    y += step;
  }
  ctx.textAlign = 'start';
}

// ── paper: fill, grain, ruling, margins, holes, logo ────────────────────────

function paintPaper(
  ctx: CanvasRenderingContext2D,
  geom: Geometry,
  s: Settings,
  pageIdx: number,
  res: RenderResources
): void {
  const { pageW: w, pageH: h } = geom;

  ctx.fillStyle = s.paperColor;
  ctx.fillRect(0, 0, w, h);

  if (s.grain > 0) paintGrain(ctx, geom, s, pageIdx);

  if (s.ruling) {
    const startX = s.rulingInMargin ? 0 : s.marginLeft ? s.marginLeftWidth : 0;
    ctx.strokeStyle = s.lineColor;
    ctx.lineWidth = s.lineThickness;
    ctx.beginPath();
    for (let y = geom.firstBaseline; y <= h - 8; y += geom.pitch) {
      ctx.moveTo(startX, y + 2);
      ctx.lineTo(w, y + 2);
    }
    ctx.stroke();
  }

  ctx.lineWidth = 1.6;
  ctx.strokeStyle = s.marginColor;
  if (s.marginTop) {
    ctx.beginPath();
    ctx.moveTo(0, s.marginTopHeight);
    ctx.lineTo(w, s.marginTopHeight);
    ctx.stroke();
  }
  if (s.marginLeft) {
    ctx.beginPath();
    ctx.moveTo(s.marginLeftWidth, 0);
    ctx.lineTo(s.marginLeftWidth, h);
    ctx.stroke();
  }

  if (s.punchHoles) paintHoles(ctx, geom, s, pageIdx);
  if (s.logo) paintLogo(ctx, geom, s, res);
}

function paintGrain(ctx: CanvasRenderingContext2D, geom: Geometry, s: Settings, pageIdx: number): void {
  const rng = derive(s.seed, 11, pageIdx + 1);
  const { pageW: w, pageH: h } = geom;
  const speckles = Math.round(s.grain * 2200);
  for (let i = 0; i < speckles; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const size = 0.4 + rng() * 0.9;
    ctx.fillStyle = `rgba(96,88,70,${(0.02 + rng() * 0.05).toFixed(3)})`;
    ctx.fillRect(x, y, size, size);
  }
  const fibers = Math.round(s.grain * 36);
  ctx.lineWidth = 0.5;
  for (let i = 0; i < fibers; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const len = 5 + rng() * 12;
    const ang = rng() * Math.PI;
    ctx.strokeStyle = `rgba(110,104,90,${(0.02 + rng() * 0.035).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(ang) * len * 0.5 + spread(rng) * 3,
      y + Math.sin(ang) * len * 0.5 + spread(rng) * 3,
      x + Math.cos(ang) * len,
      y + Math.sin(ang) * len
    );
    ctx.stroke();
  }
}

/** Hole vertical positions (fractions), from spread when synced or explicit list. */
function holeFractions(s: Settings): number[] {
  const n = Math.max(2, Math.min(3, s.holeCount));
  if (!s.holeSync) return s.holePositions.slice(0, n);
  const spreadFrac = 0.12 + s.holeSpread * 0.76; // total span 0.12..0.88 of the height
  const top = 0.5 - spreadFrac / 2;
  if (n === 2) return [top, 1 - top];
  return [top, 0.5, 1 - top];
}

function paintHoles(ctx: CanvasRenderingContext2D, geom: Geometry, s: Settings, pageIdx: number): void {
  const rng = derive(s.seed, 29, pageIdx + 1);
  const cx = s.holesRight ? geom.pageW - s.holeMargin : s.holeMargin;
  const r = Math.max(4, s.holeSize);
  for (const frac of holeFractions(s)) {
    const x = cx + spread(rng) * 2.5;
    const y = geom.pageH * Math.max(0.04, Math.min(0.96, frac)) + spread(rng) * 4;
    ctx.save();
    const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.2, x, y, r);
    g.addColorStop(0, '#dededa');
    g.addColorStop(1, '#e9e9e5');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.20)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, r - 0.8, Math.PI * 0.75, Math.PI * 1.6);
    ctx.stroke();
    ctx.restore();
  }
}

function logoAnchor(pos: Settings['logoPosition'], geom: Geometry): { x: number; y: number; align: CanvasTextAlign } {
  const m = 16;
  switch (pos) {
    case 'top-left': return { x: m, y: m + 6, align: 'left' };
    case 'top-right': return { x: geom.pageW - m, y: m + 6, align: 'right' };
    case 'bottom-left': return { x: m, y: geom.pageH - m, align: 'left' };
    case 'bottom-right': return { x: geom.pageW - m, y: geom.pageH - m, align: 'right' };
    case 'center': return { x: geom.pageW / 2, y: geom.pageH / 2, align: 'center' };
  }
}

function paintLogo(ctx: CanvasRenderingContext2D, geom: Geometry, s: Settings, res: RenderResources): void {
  const { x, y, align } = logoAnchor(s.logoPosition, geom);
  ctx.save();
  ctx.globalAlpha = s.logoOpacity;
  ctx.translate(x, y);
  if (s.logoRotation) ctx.rotate((s.logoRotation * Math.PI) / 180);

  if (s.logoMode === 'image') {
    const img = res.logoImage;
    if (img) {
      const targetW = geom.pageW * s.logoScale;
      const targetH = (img.naturalHeight / img.naturalWidth) * targetW;
      const dx = align === 'right' ? -targetW : align === 'center' ? -targetW / 2 : 0;
      const dy = s.logoPosition.startsWith('bottom') ? -targetH : s.logoPosition === 'center' ? -targetH / 2 : 0;
      ctx.drawImage(img, dx, dy, targetW, targetH);
    }
  } else {
    const text = (s.logoText || 'Brand').toUpperCase();
    // Font size chosen so the text roughly fills the requested width fraction.
    const targetW = geom.pageW * s.logoScale;
    ctx.font = `600 20px "${s.logoFont}", Arial, sans-serif`;
    const spaced = text.split('').join(' ');
    const natural = ctx.measureText(spaced).width || 1;
    const size = Math.max(7, Math.min(64, (20 * targetW) / natural));
    ctx.font = `600 ${size}px "${s.logoFont}", Arial, sans-serif`;
    ctx.fillStyle = s.logoColor;
    ctx.textAlign = align;
    ctx.textBaseline = s.logoPosition.startsWith('bottom') ? 'bottom' : s.logoPosition === 'center' ? 'middle' : 'top';
    ctx.fillText(spaced, 0, 0);
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'start';
}

function paintFooter(ctx: CanvasRenderingContext2D, geom: Geometry, s: Settings, scribe: Scribe): void {
  const top = geom.footerTop!;
  const { pageW: w, pageH: h } = geom;
  const rows = s.footerRows.length ? s.footerRows : ['Name:'];
  const fontPx = 11 * s.footerScale;
  const family = s.footerHandwritten ? (s.fontFamily === '@atlas' ? 'Homemade Apple' : s.fontFamily) : 'Arial, sans-serif';

  ctx.save();
  ctx.globalAlpha = s.footerOpacity;
  ctx.strokeStyle = s.footerColor;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(14, top);
  ctx.lineTo(w - 14, top);
  ctx.stroke();

  ctx.font = `${fontPx}px ${s.footerHandwritten ? `"${family}", cursive` : family}`;
  ctx.fillStyle = s.footerColor;
  ctx.textBaseline = 'alphabetic';

  let y = top + Math.max(20, fontPx * 2);
  const rowH = (h - top - fontPx * 2) / rows.length;
  for (const raw of rows) {
    const parts = raw.split('|').map((p) => p.trim());
    if (parts.length > 1) {
      const mid = 14 + (w - 28) / 2;
      ctx.fillText(parts[0], 20, y);
      line(ctx, 24 + ctx.measureText(parts[0]).width, y + 2, mid - 16, y + 2, s.footerColor);
      ctx.fillText(parts[1], mid, y);
      line(ctx, mid + 6 + ctx.measureText(parts[1]).width, y + 2, w - 20, y + 2, s.footerColor);
    } else {
      ctx.fillText(parts[0], 20, y);
      line(ctx, 24 + ctx.measureText(parts[0]).width, y + 2, w - 20, y + 2, s.footerColor);
    }
    y += rowH;
  }
  ctx.restore();
  void scribe;
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string): void {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

// ── handwritten text ────────────────────────────────────────────────────────

function paintText(
  ctx: CanvasRenderingContext2D,
  page: PageLayout,
  pageIdx: number,
  geom: Geometry,
  s: Settings,
  scribe: Scribe
): void {
  const j = s.jitter;

  page.lines.forEach((pline, lineIdx) => {
    if (!pline.tokens.length) return;
    const y = baselineY(geom, lineIdx);
    const lineRng = derive(s.seed, 23, pageIdx + 1, lineIdx + 1);
    const wobblePhase = lineRng() * Math.PI * 2;
    const wobbleAmp = s.baselineWobble * 2.2;

    pline.tokens.forEach((tok, tokIdx) => {
      const rng = derive(s.seed, 17, pageIdx + 1, lineIdx + 1, tokIdx + 1);
      const tokCx = geom.textLeft + tok.x + tok.w / 2;
      const wobbleDy = Math.sin(tokCx * 0.011 + wobblePhase) * wobbleAmp;
      const wordRot = spread(rng) * 0.0305 * j;
      const wordDy = spread(rng) * 1.25 * j;
      const wordSx = 1 + spread(rng) * 0.025 * j;
      const wordSy = 1 + spread(rng) * 0.035 * j;
      const strikeAlpha = tok.strike ? 0.55 + rng() * 0.25 : 1;

      ctx.save();
      ctx.translate(tokCx, y + wordDy + wobbleDy);
      ctx.rotate(wordRot);
      ctx.scale(wordSx, wordSy);

      for (const c of tok.chars) {
        const charDy = spread(rng) * 1.4 * j;
        const charRot = spread(rng) * 0.0131 * j;
        const sizeF = 1 + spread(rng) * 0.05 * j;
        const flow = 1 - rng() * 0.3 * s.inkFlow;
        const variantRnd = rng();
        if (c.ch === ' ') continue;

        ctx.save();
        ctx.translate(c.x - tok.w / 2 + c.w / 2, charDy);
        ctx.rotate(charRot);
        ctx.scale(sizeF, sizeF);
        ctx.translate(-c.w / 2, 0);
        ctx.globalAlpha = flow * strikeAlpha;
        scribe.draw(ctx, c.ch, c.color ?? s.inkColor, variantRnd);
        ctx.restore();
      }

      if (tok.strike) paintStrike(ctx, tok, s, scribe, rng);
      ctx.restore();
    });
  });
}

/** Hand-drawn cross-out: 2-3 overlapping curved strokes, seeded. */
function paintStrike(ctx: CanvasRenderingContext2D, tok: PlacedToken, s: Settings, scribe: Scribe, rng: Rng): void {
  const color = tok.chars[0]?.color ?? s.inkColor;
  const midY = -scribe.sizePx * 0.26;
  const n = rng() < 0.45 ? 3 : 2;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x0 = -tok.w / 2 - (1 + rng() * 4);
    const x1 = tok.w / 2 + (1 + rng() * 5);
    const y0 = midY + spread(rng) * scribe.sizePx * 0.09;
    const y1 = y0 + spread(rng) * (x1 - x0) * 0.07;
    const cx = (x0 + x1) / 2 + spread(rng) * 6;
    const cy = (y0 + y1) / 2 + spread(rng) * 3.5;
    ctx.lineWidth = 0.9 + rng() * 1.6;
    ctx.globalAlpha = 0.45 + rng() * 0.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
