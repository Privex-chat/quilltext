import { AtlasData, AtlasGlyph, Atlas, AtlasScribe, saveAtlasData } from '../engine/atlas';
import { FontScribe } from '../engine/scribe';
import { store } from '../state/store';
import { toast } from './chrome';

/**
 * Handwriting cloning, stage 1 (glyph atlas):
 *   1. print a template sheet
 *   2. write the characters, photograph the sheet
 *   3. align 4 corners → homography warp → per-cell threshold → glyph atlas
 * Fully client-side. Stage 2 (ML stroke synthesis) is a future server feature.
 */

const TPL = {
  w: 1000,
  h: 1414, // A4 ratio
  fid: 43, // fiducial center inset
  fidSize: 26,
  gx0: 70,
  gy0: 120,
  gx1: 930,
  gy1: 1370,
  cols: 10,
  rows: 15,
  baseline: 0.74,
  labelStrip: 0.2
};
const CHARSET = [
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'0123456789',
  ...".,;:!?'\"()-"
];
const VARIANTS = 2;
const WARP_K = 1.6; // canonical warp scale: template px → warp px

const cellW = (TPL.gx1 - TPL.gx0) / TPL.cols;
const cellH = (TPL.gy1 - TPL.gy0) / TPL.rows;

const cellRect = (index: number) => {
  const col = index % TPL.cols;
  const row = Math.floor(index / TPL.cols);
  return { x: TPL.gx0 + col * cellW, y: TPL.gy0 + row * cellH };
};

// ── template sheet ───────────────────────────────────────────────────────────

export function drawTemplate(scale = 2): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TPL.w * scale;
  c.height = TPL.h * scale;
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, TPL.w, TPL.h);

  ctx.fillStyle = '#000';
  for (const [fx, fy] of [
    [TPL.fid, TPL.fid],
    [TPL.w - TPL.fid, TPL.fid],
    [TPL.w - TPL.fid, TPL.h - TPL.fid],
    [TPL.fid, TPL.h - TPL.fid]
  ]) {
    ctx.fillRect(fx - TPL.fidSize / 2, fy - TPL.fidSize / 2, TPL.fidSize, TPL.fidSize);
  }

  ctx.fillStyle = '#333';
  ctx.font = '600 20px Arial, sans-serif';
  ctx.fillText('Quilltext handwriting sheet', TPL.gx0, 78);
  ctx.font = '13px Arial, sans-serif';
  ctx.fillStyle = '#666';
  ctx.fillText(
    'Write each character with your usual pen, sitting on the light baseline. Fill both copies.',
    TPL.gx0,
    100
  );

  for (let i = 0; i < CHARSET.length * VARIANTS; i++) {
    const { x, y } = cellRect(i);
    ctx.strokeStyle = '#c9c9c9';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, cellW, cellH);

    ctx.fillStyle = '#9a9a9a';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(CHARSET[i % CHARSET.length], x + 5, y + 14);

    // Light dashed baseline: visible in print, below the capture threshold.
    ctx.strokeStyle = '#e2e2e2';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x + 5, y + cellH * TPL.baseline);
    ctx.lineTo(x + cellW - 5, y + cellH * TPL.baseline);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  return c;
}

// ── homography (4-point DLT) ────────────────────────────────────────────────

type Pt = { x: number; y: number };

/** H maps template coords → photo coords. */
function homography(dst: Pt[], src: Pt[]): number[] {
  // Solve A·h = b for h = [h11..h32], h33 = 1
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i];
    const { x: X, y: Y } = src[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  // Gaussian elimination with partial pivoting
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-12;
    for (let c = col; c <= n; c++) M[col][c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return [...M.map((row) => row[n]), 1];
}

const applyH = (h: number[], x: number, y: number): Pt => {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
};

// ── warp + extraction ────────────────────────────────────────────────────────

function warpPhoto(photo: HTMLCanvasElement, corners: Pt[]): HTMLCanvasElement {
  const dstFids: Pt[] = [
    { x: TPL.fid, y: TPL.fid },
    { x: TPL.w - TPL.fid, y: TPL.fid },
    { x: TPL.w - TPL.fid, y: TPL.h - TPL.fid },
    { x: TPL.fid, y: TPL.h - TPL.fid }
  ];
  const H = homography(dstFids, corners);

  const out = document.createElement('canvas');
  out.width = Math.round(TPL.w * WARP_K);
  out.height = Math.round(TPL.h * WARP_K);
  const octx = out.getContext('2d')!;
  const src = photo.getContext('2d')!.getImageData(0, 0, photo.width, photo.height);
  const dst = octx.createImageData(out.width, out.height);
  const sd = src.data;
  const dd = dst.data;
  const sw = photo.width;
  const sh = photo.height;

  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const p = applyH(H, x / WARP_K, y / WARP_K);
      const sx = Math.round(p.x);
      const sy = Math.round(p.y);
      const di = (y * out.width + x) * 4;
      if (sx < 0 || sy < 0 || sx >= sw || sy >= sh) {
        dd[di] = dd[di + 1] = dd[di + 2] = 255;
        dd[di + 3] = 255;
        continue;
      }
      const si = (sy * sw + sx) * 4;
      dd[di] = sd[si];
      dd[di + 1] = sd[si + 1];
      dd[di + 2] = sd[si + 2];
      dd[di + 3] = 255;
    }
  }
  octx.putImageData(dst, 0, 0);
  return out;
}

interface Extraction {
  data: AtlasData;
  captured: number;
  missing: string[];
}

function extractAtlas(warped: HTMLCanvasElement, name: string): Extraction {
  const ctx = warped.getContext('2d')!;
  const img = ctx.getImageData(0, 0, warped.width, warped.height);
  const px = img.data;
  const W = warped.width;
  const lum = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  };

  interface RawGlyph {
    ch: string;
    canvas: HTMLCanvasElement;
    bearingY: number;
    advance: number;
  }
  const raw: RawGlyph[] = [];

  for (let i = 0; i < CHARSET.length * VARIANTS; i++) {
    const ch = CHARSET[i % CHARSET.length];
    const { x: cx, y: cy } = cellRect(i);
    // Sample region avoids the printed label strip and the cell borders.
    const x0 = Math.round((cx + cellW * 0.07) * WARP_K);
    const x1 = Math.round((cx + cellW * 0.93) * WARP_K);
    const y0 = Math.round((cy + cellH * TPL.labelStrip) * WARP_K);
    const y1 = Math.round((cy + cellH * 0.97) * WARP_K);
    const baselineY = (cy + cellH * TPL.baseline) * WARP_K;

    let sum = 0;
    let count = 0;
    for (let y = y0; y < y1; y += 2)
      for (let x = x0; x < x1; x += 2) {
        sum += lum(x, y);
        count++;
      }
    const mean = sum / Math.max(1, count);
    const thr = mean - 44;

    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity, ink = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        if (lum(x, y) < thr) {
          ink++;
          if (x < bx0) bx0 = x;
          if (x > bx1) bx1 = x;
          if (y < by0) by0 = y;
          if (y > by1) by1 = y;
        }
      }
    if (ink < 18) continue; // empty cell

    const gw = bx1 - bx0 + 1;
    const gh = by1 - by0 + 1;
    const g = document.createElement('canvas');
    g.width = gw;
    g.height = gh;
    const gctx = g.getContext('2d')!;
    const gimg = gctx.createImageData(gw, gh);
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const l = lum(bx0 + x, by0 + y);
        const a = Math.max(0, Math.min(1, (thr - l) / 26 + 0.55));
        const di = (y * gw + x) * 4;
        if (l < thr) {
          gimg.data[di + 3] = Math.round(a * 255);
        }
      }
    gctx.putImageData(gimg, 0, 0);

    raw.push({
      ch,
      canvas: g,
      bearingY: by0 - baselineY,
      advance: gw + cellW * WARP_K * 0.09
    });
  }

  // Shelf-pack the sheet.
  const SHEET_W = 1200;
  const GAP = 3;
  let sx = GAP, sy = GAP, rowH = 0;
  const placements: { g: RawGlyph; x: number; y: number }[] = [];
  for (const g of raw) {
    if (sx + g.canvas.width + GAP > SHEET_W) {
      sx = GAP;
      sy += rowH + GAP;
      rowH = 0;
    }
    placements.push({ g, x: sx, y: sy });
    sx += g.canvas.width + GAP;
    rowH = Math.max(rowH, g.canvas.height);
  }
  const sheet = document.createElement('canvas');
  sheet.width = SHEET_W;
  sheet.height = sy + rowH + GAP;
  const sctx = sheet.getContext('2d')!;
  for (const p of placements) sctx.drawImage(p.g.canvas, p.x, p.y);

  const glyphs: Record<string, AtlasGlyph[]> = {};
  for (const p of placements) {
    (glyphs[p.g.ch] ??= []).push({
      x: p.x,
      y: p.y,
      w: p.g.canvas.width,
      h: p.g.canvas.height,
      advance: p.g.advance,
      bearingY: p.g.bearingY
    });
  }

  // Calibrate the em: median lowercase height ≈ half an em of handwriting.
  const xHeights = 'acemnorsuvwxz'
    .split('')
    .flatMap((ch) => glyphs[ch]?.map((g) => g.h) ?? [])
    .sort((a, b) => a - b);
  const xh = xHeights.length ? xHeights[Math.floor(xHeights.length / 2)] : cellH * WARP_K * 0.34;
  const unitH = xh / 0.5;

  const advances = Object.keys(glyphs)
    .filter((ch) => /[a-z]/.test(ch))
    .flatMap((ch) => glyphs[ch].map((g) => g.advance))
    .sort((a, b) => a - b);
  const spaceAdvance = advances.length ? advances[Math.floor(advances.length / 2)] * 0.55 : unitH * 0.3;

  const capturedChars = Object.keys(glyphs);
  const missing = CHARSET.filter((ch) => !capturedChars.includes(ch));

  return {
    data: {
      version: 1,
      name,
      createdAt: Date.now(),
      unitH,
      spaceAdvance,
      glyphs,
      sheet: sheet.toDataURL('image/png')
    },
    captured: capturedChars.length,
    missing
  };
}

// ── wizard dialog ────────────────────────────────────────────────────────────

let dlg: HTMLDialogElement | null = null;
let photo: HTMLCanvasElement | null = null;
let corners: Pt[] = [];
let extraction: Extraction | null = null;

export function openWizard(): void {
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.className = 'wizard';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg!.close();
    });
  }
  photo = null;
  corners = [];
  extraction = null;
  renderStep(1);
  dlg.showModal();
}

function renderStep(step: 1 | 2 | 3): void {
  const d = dlg!;
  d.innerHTML = `
    <header class="wiz-head">
      <strong>Clone my handwriting</strong>
      <ol class="wiz-steps">
        ${['Print', 'Photograph', 'Review'].map((t, i) => `<li class="${i + 1 === step ? 'is-cur' : i + 1 < step ? 'is-done' : ''}">${t}</li>`).join('')}
      </ol>
      <button class="icon-btn wiz-close" aria-label="Close">✕</button>
    </header>
    <div class="wiz-body"></div>
    <footer class="wiz-foot"></footer>`;
  d.querySelector('.wiz-close')!.addEventListener('click', () => d.close());
  const body = d.querySelector<HTMLElement>('.wiz-body')!;
  const foot = d.querySelector<HTMLElement>('.wiz-foot')!;

  if (step === 1) {
    body.innerHTML = `
      <p>Download the template sheet, print it, and write each character in its box with the pen you normally use. Two boxes per character give your writing natural variety.</p>
      <div class="wiz-tpl-preview"></div>
      <p class="ctl-hint">Tips: dark ink, letters sitting on the dashed baseline, decent lighting when you photograph it.</p>`;
    const prev = drawTemplate(0.5);
    prev.className = 'wiz-tpl-canvas';
    body.querySelector('.wiz-tpl-preview')!.appendChild(prev);
    foot.innerHTML = '';
    foot.append(
      btn('Download sheet (PNG)', () => {
        drawTemplate(2).toBlob((b) => {
          if (!b) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = 'quilltext-handwriting-sheet.png';
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        });
      }),
      btn('I have a photo →', () => renderStep(2), 'btn-primary')
    );
  }

  if (step === 2) {
    body.innerHTML = `
      <p>Upload the photo, then drag the four handles onto the centers of the black corner squares.</p>
      <input type="file" accept="image/*" class="wiz-file">
      <div class="wiz-align" hidden><canvas class="wiz-align-canvas"></canvas></div>`;
    const file = body.querySelector<HTMLInputElement>('.wiz-file')!;
    const alignHost = body.querySelector<HTMLElement>('.wiz-align')!;
    const canvas = body.querySelector<HTMLCanvasElement>('.wiz-align-canvas')!;

    const next = btn('Extract my handwriting →', async () => {
      if (!photo) return;
      const n = next as HTMLButtonElement;
      n.disabled = true;
      n.textContent = 'Extracting…';
      await new Promise((r) => setTimeout(r, 30)); // let the label paint
      try {
        const warped = warpPhoto(photo, corners);
        extraction = extractAtlas(warped, 'My handwriting');
        if (extraction.captured < 10) {
          toast('Very few characters were found. Check corner alignment and lighting, then try again.', 'error', 6000);
          n.disabled = false;
          n.textContent = 'Extract my handwriting →';
          return;
        }
        renderStep(3);
      } catch (err) {
        toast(`Extraction failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
        n.disabled = false;
        n.textContent = 'Extract my handwriting →';
      }
    }, 'btn-primary');
    (next as HTMLButtonElement).disabled = true;

    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        photo = await loadPhoto(f);
        alignHost.hidden = false;
        initAlign(canvas, alignHost);
        (next as HTMLButtonElement).disabled = false;
      } catch {
        toast('That image could not be read.', 'error');
      }
    });

    foot.innerHTML = '';
    foot.append(btn('← Back', () => renderStep(1)), next);
  }

  if (step === 3 && extraction) {
    const { captured, missing } = extraction;
    body.innerHTML = `
      <p><strong>${captured} of ${CHARSET.length} characters captured.</strong>
      ${missing.length ? `Missing: <code>${missing.join(' ')}</code> (they fall back to a font).` : 'Full set!'}</p>
      <p class="ctl-label">Preview</p>
      <canvas class="wiz-sample"></canvas>`;
    void renderSample(body.querySelector('.wiz-sample')!);
    foot.innerHTML = '';
    foot.append(
      btn('← Re-align', () => renderStep(2)),
      btn('Use my handwriting', async () => {
        saveAtlasData(extraction!.data);
        await store.setAtlas(extraction!.data);
        store.set('fontFamily', '@atlas');
        toast('Your handwriting is ready. It stays in this browser only.', 'success', 5000);
        dlg!.close();
      }, 'btn-primary')
    );
  }
}

function btn(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `btn ${cls}`.trim();
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

async function loadPhoto(file: File): Promise<HTMLCanvasElement> {
  if (file.size > 15 * 1024 * 1024) throw new Error('Photo too large');
  const bmp = await createImageBitmap(file);
  const maxDim = 2600;
  const k = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

function initAlign(canvas: HTMLCanvasElement, host: HTMLElement): void {
  const p = photo!;
  const maxW = Math.min(640, host.clientWidth || 640);
  const view = Math.min(1, maxW / p.width, 560 / p.height);
  canvas.width = Math.round(p.width * view);
  canvas.height = Math.round(p.height * view);

  corners = [
    { x: p.width * 0.06, y: p.height * 0.05 },
    { x: p.width * 0.94, y: p.height * 0.05 },
    { x: p.width * 0.94, y: p.height * 0.95 },
    { x: p.width * 0.06, y: p.height * 0.95 }
  ];

  const ctx = canvas.getContext('2d')!;
  const draw = () => {
    ctx.drawImage(p, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#2f6bff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    corners.forEach((c, i) => {
      const x = c.x * view;
      const y = c.y * view;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    corners.forEach((c) => {
      ctx.beginPath();
      ctx.arc(c.x * view, c.y * view, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(47,107,255,0.25)';
      ctx.fill();
      ctx.strokeStyle = '#2f6bff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };
  draw();

  let dragging = -1;
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * canvas.width;
    const y = ((e.clientY - r.top) / r.height) * canvas.height;
    let best = -1;
    let bestD = 26 * 26;
    corners.forEach((c, i) => {
      const d = (c.x * view - x) ** 2 + (c.y * view - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    dragging = best;
    if (best >= 0) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging < 0) return;
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * canvas.width;
    const y = ((e.clientY - r.top) / r.height) * canvas.height;
    corners[dragging] = {
      x: Math.max(0, Math.min(photo!.width, x / view)),
      y: Math.max(0, Math.min(photo!.height, y / view))
    };
    draw();
  });
  canvas.addEventListener('pointerup', () => (dragging = -1));
}

async function renderSample(canvas: HTMLCanvasElement): Promise<void> {
  const atlas = await Atlas.load(extraction!.data);
  const sizePx = 26;
  const scribe = new AtlasScribe(atlas, sizePx, new FontScribe('Homemade Apple', sizePx));
  const text = 'The quick brown fox jumps over the lazy dog, 0123456789.';
  canvas.width = 620;
  canvas.height = 88;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'alphabetic';
  let x = 12;
  let y = 40;
  for (const ch of text) {
    const w = scribe.width(ch);
    if (x + w > canvas.width - 12) {
      x = 12;
      y += 38;
    }
    if (ch !== ' ') {
      ctx.save();
      ctx.translate(x, y);
      scribe.draw(ctx, ch, '#000f55', Math.random());
      ctx.restore();
    }
    x += w;
  }
}
