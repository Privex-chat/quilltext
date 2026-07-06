import { Settings } from './types';
import { getPhoneProfile } from './exif';
import { derive, spread, Rng } from './rng';

/**
 * Finish pass. Runs on the painted page canvas at ITS resolution, so preview
 * (small) and export (large) get identical treatment from the same code.
 * Randomness is seeded per page: reshuffles when the seed changes, and every
 * page in a document differs, like real photos.
 *
 * Pixel loops run on the main thread; at export scale 4 a page is
 * ~14M px. Move to a Worker + OffscreenCanvas if it ever hurts.
 */
export function applyFinish(canvas: HTMLCanvasElement, s: Settings, pageIdx: number): HTMLCanvasElement {
  const rng = derive(s.seed, 41, pageIdx + 1);
  switch (s.finish) {
    case 'none':
      return canvas;
    case 'shadow':
      realisticShadow(canvas, s, rng);
      return canvas;
    case 'scanner':
      realisticShadow(canvas, s, rng, 0.6);
      contrast(canvas, 0.4);
      return canvas;
    case 'phone':
      return phoneScan(canvas, s, rng, pageIdx);
    case 'desk':
      return deskScene(canvas, s, rng);
  }
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function hexRgb(hex: string): { r: number; g: number; b: number } {
  const n = hex.replace('#', '');
  const v = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  return { r: parseInt(v.slice(0, 2), 16) || 0, g: parseInt(v.slice(2, 4), 16) || 0, b: parseInt(v.slice(4, 6), 16) || 0 };
}

/**
 * Overcast shadow that is NOT a fixed left-to-right ramp. Combines a soft
 * directional gradient from a random edge with a couple of irregular blobs and
 * an occluder wedge (like a hand or phone edge), so no two look alike.
 */
function realisticShadow(canvas: HTMLCanvasElement, s: Settings, rng: Rng, intensityMul = 1): void {
  if (s.shadowOpacity <= 0) return;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const { r, g, b } = hexRgb(s.shadowColor);
  const base = s.shadowOpacity * intensityMul;
  const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // 1) soft directional wash from a random corner/edge
  const angle = s.shadowRandom ? rng() * Math.PI * 2 : ((s.shadowAngle - 90) * Math.PI) / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const g1 = ctx.createLinearGradient(w / 2 - (dx * len) / 2, h / 2 - (dy * len) / 2, w / 2 + (dx * len) / 2, h / 2 + (dy * len) / 2);
  g1.addColorStop(0, rgba(base * 0.9));
  g1.addColorStop(Math.max(0.05, Math.min(1, s.shadowCoverage)), rgba(0));
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  // 2) irregular soft blobs - object shadows falling on the page
  const blobs = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < blobs; i++) {
    const cx = rng() * w;
    const cy = rng() * h;
    const rad = (0.25 + rng() * 0.4) * Math.max(w, h);
    const rg = ctx.createRadialGradient(cx, cy, rad * 0.1, cx, cy, rad);
    rg.addColorStop(0, rgba(base * (0.35 + rng() * 0.3)));
    rg.addColorStop(1, rgba(0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }

  // 3) occluder wedge from one edge (a hand/phone edge blocking light)
  if (rng() < 0.7) {
    const edge = Math.floor(rng() * 4);
    const depth = (0.12 + rng() * 0.22) * (edge % 2 === 0 ? h : w);
    ctx.save();
    ctx.beginPath();
    const jag = () => (rng() - 0.5) * 0.16;
    if (edge === 0) {
      ctx.moveTo(0, 0); ctx.lineTo(w, 0);
      ctx.lineTo(w, depth * (1 + jag())); ctx.lineTo(w * 0.5, depth * (1 + jag()));
      ctx.lineTo(0, depth * (1 + jag()));
    } else if (edge === 1) {
      ctx.moveTo(w, 0); ctx.lineTo(w, h);
      ctx.lineTo(w - depth * (1 + jag()), h); ctx.lineTo(w - depth * (1 + jag()), 0);
    } else if (edge === 2) {
      ctx.moveTo(0, h); ctx.lineTo(w, h);
      ctx.lineTo(w, h - depth * (1 + jag())); ctx.lineTo(0, h - depth * (1 + jag()));
    } else {
      ctx.moveTo(0, 0); ctx.lineTo(0, h);
      ctx.lineTo(depth * (1 + jag()), h); ctx.lineTo(depth * (1 + jag()), 0);
    }
    ctx.closePath();
    const og = edge % 2 === 0
      ? ctx.createLinearGradient(0, edge === 0 ? 0 : h, 0, edge === 0 ? depth : h - depth)
      : ctx.createLinearGradient(edge === 1 ? w : 0, 0, edge === 1 ? w - depth : depth, 0);
    og.addColorStop(0, rgba(base * 0.85));
    og.addColorStop(1, rgba(0));
    ctx.fillStyle = og;
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function contrast(canvas: HTMLCanvasElement, amount: number): void {
  const ctx = canvas.getContext('2d')!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const c = amount * 255;
  const factor = (c + 255) / (255.01 - c);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = factor * (d[i] - 128) + 128;
    d[i + 1] = factor * (d[i + 1] - 128) + 128;
    d[i + 2] = factor * (d[i + 2] - 128) + 128;
  }
  ctx.putImageData(img, 0, 0);
}

/** Phone-photo look: selected phone profile + perspective, sensor grain, shadows and lens falloff. */
function phoneScan(source: HTMLCanvasElement, s: Settings, rng: Rng, pageIdx: number): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const profile = getPhoneProfile(s.phoneProfileId);
  const rotation = spread(rng) * Math.max(0, s.phoneRotation);
  const wb = phoneWhiteBalance(s, profile.make, rng);
  const isoLift = Math.max(0, Math.min(0.45, (profile.iso - 50) / 260));
  const effScale = Math.max(1, w / 794);
  const grain255 = clamp01(s.scanGrain) * (28 + isoLift * 24) * Math.sqrt(effScale);

  const pad = Math.ceil(Math.max(w, h) * 0.02) + Math.round(w * 0.03);
  const out = document.createElement('canvas');
  out.width = w + pad * 2;
  out.height = h + pad * 2;
  const ctx = out.getContext('2d')!;

  // Slight off-white background (phone auto-exposure rarely gives pure white)
  ctx.fillStyle = `rgb(${248 + Math.round(rng() * 5)},${247 + Math.round(rng() * 5)},${244 + Math.round(rng() * 7)})`;
  ctx.fillRect(0, 0, out.width, out.height);

  // Keystone: draw the page as a slightly non-rectangular quad (camera angle)
  const perspective = clamp01(s.phonePerspective);
  const k = perspective * (0.006 + rng() * 0.022);
  const corners: [number, number][] = [
    [pad + w * spread(rng) * k, pad + h * spread(rng) * k],
    [pad + w - w * spread(rng) * k, pad + h * spread(rng) * k],
    [pad + w - w * spread(rng) * k, pad + h - h * spread(rng) * k],
    [pad + w * spread(rng) * k, pad + h - h * spread(rng) * k]
  ];
  ctx.save();
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-out.width / 2, -out.height / 2);
  const blurPx = clamp01(s.phoneBlur) * 0.78 * (w / 794);
  if (blurPx > 0.01) ctx.filter = `blur(${blurPx.toFixed(2)}px)`;
  drawQuad(ctx, source, corners);
  ctx.restore();

  // Uneven auto-exposure and room light. This is subtle but helps phone shots
  // avoid the perfectly flat scanner look.
  phoneLightWash(ctx, out.width, out.height, s.phoneExposureBias, rng);

  // Pixel pass: deterministic grain + white balance.
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const grainRng = derive(s.seed, 53, pageIdx + 1);
  const exposure = s.phoneExposureBias * 44;
  for (let i = 0; i < d.length; i += 4) {
    const gnoise = (grainRng() - 0.5) * grain255;
    d[i] = clamp255(d[i] + wb.r + exposure + gnoise);
    d[i + 1] = clamp255(d[i + 1] + exposure * 0.72 + gnoise * 0.85);
    d[i + 2] = clamp255(d[i + 2] + wb.b + exposure * 0.54 + gnoise * 0.7);
  }
  ctx.putImageData(img, 0, 0);

  compressionArtifacts(out, s.phoneCompression);

  if (s.phoneShadows && s.phoneShadowIntensity > 0) {
    realisticShadow(
      out,
      {
        ...s,
        shadowOpacity: 0.08 + clamp01(s.phoneShadowIntensity) * 0.34,
        shadowRandom: true,
        shadowCoverage: 0.48 + rng() * 0.22
      },
      rng,
      0.92
    );
  }

  vignette(ctx, out.width, out.height, clamp01(s.phoneVignette) * (0.36 + rng() * 0.12));

  const edgeL = ctx.createLinearGradient(0, 0, out.width * 0.012, 0);
  edgeL.addColorStop(0, 'rgba(0,0,0,0.09)');
  edgeL.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edgeL;
  ctx.fillRect(0, 0, out.width * 0.012, out.height);
  const edgeB = ctx.createLinearGradient(0, out.height, 0, out.height * 0.985);
  edgeB.addColorStop(0, 'rgba(0,0,0,0.065)');
  edgeB.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edgeB;
  ctx.fillRect(0, out.height * 0.985, out.width, out.height * 0.015);

  return out;
}

function phoneWhiteBalance(s: Settings, make: string, rng: Rng): { r: number; b: number } {
  const mode = s.phoneWhiteBalance === 'auto'
    ? (rng() < (make.toLowerCase().includes('google') ? 0.46 : 0.62) ? 'warm' : 'cool')
    : s.phoneWhiteBalance;
  if (mode === 'warm') return { r: 8 + rng() * 12, b: -(5 + rng() * 9) };
  if (mode === 'cool') return { r: -(3 + rng() * 7), b: 5 + rng() * 11 };
  return { r: spread(rng) * 2, b: spread(rng) * 2 };
}

function phoneLightWash(ctx: CanvasRenderingContext2D, w: number, h: number, bias: number, rng: Rng): void {
  const angle = rng() * Math.PI * 2;
  const cx = w / 2;
  const cy = h / 2;
  const len = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle));
  const g = ctx.createLinearGradient(
    cx - Math.cos(angle) * len * 0.5,
    cy - Math.sin(angle) * len * 0.5,
    cx + Math.cos(angle) * len * 0.5,
    cy + Math.sin(angle) * len * 0.5
  );
  const lift = 0.035 + Math.abs(bias) * 0.14;
  g.addColorStop(0, `rgba(255,255,255,${lift.toFixed(3)})`);
  g.addColorStop(0.55, 'rgba(255,255,255,0)');
  g.addColorStop(1, `rgba(0,0,0,${(lift * 0.6).toFixed(3)})`);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function compressionArtifacts(canvas: HTMLCanvasElement, amount: number): void {
  const a = clamp01(amount);
  if (a <= 0.01) return;
  const ctx = canvas.getContext('2d')!;
  const tmp = document.createElement('canvas');
  const effScale = Math.max(1, canvas.width / 794);
  const ratio = Math.max(0.25, 1 - a * 0.34 * Math.sqrt(effScale));
  tmp.width = Math.max(80, Math.round(canvas.width * ratio));
  tmp.height = Math.max(80, Math.round(canvas.height * ratio));
  const tctx = tmp.getContext('2d')!;
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = a < 0.55;
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

/** Page lying on a desk, shot at an angle. */
function deskScene(source: HTMLCanvasElement, s: Settings, rng: Rng): HTMLCanvasElement {
  const sw = source.width;
  const sh = source.height;
  const pad = Math.round(sw * 0.14);
  const tilt = s.deskTilt;

  const out = document.createElement('canvas');
  out.width = sw + pad * 2;
  out.height = sh + pad * 2;
  const ctx = out.getContext('2d')!;

  ctx.fillStyle = s.deskColor;
  ctx.fillRect(0, 0, out.width, out.height);

  for (let i = 0; i < 3200; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rng() * 0.06})`;
    ctx.fillRect(rng() * out.width, rng() * out.height, 1, 1);
  }
  for (let i = 0; i < 14; i++) {
    const gy = rng() * out.height;
    ctx.strokeStyle = `rgba(0,0,0,${rng() * 0.045})`;
    ctx.lineWidth = rng() * 3 + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(out.width, gy + spread(rng) * 34);
    ctx.stroke();
  }

  // Random light direction for the drop shadow (not always bottom-right)
  const la = rng() * Math.PI * 2;
  const off = (12 + tilt * 1.4) * (sw / 800);
  const tf = tilt / 1200;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = (26 + tilt * 2.4) * (sw / 800);
  ctx.shadowOffsetX = Math.cos(la) * off;
  ctx.shadowOffsetY = Math.sin(la) * off;
  ctx.fillStyle = '#fff';
  ctx.transform(1, -tf * 0.25 + spread(rng) * 0.02, tf * 0.45 + spread(rng) * 0.03, 1 - tf * 0.15, pad + tilt * 0.4, pad + tilt * 0.2);
  ctx.fillRect(0, 0, sw, sh);
  ctx.restore();

  ctx.save();
  ctx.transform(1, -tf * 0.25 + spread(rng) * 0.02, tf * 0.45 + spread(rng) * 0.03, 1 - tf * 0.15, pad + tilt * 0.4, pad + tilt * 0.2);
  ctx.drawImage(source, 0, 0);
  ctx.restore();

  if (s.deskLight > 0) {
    const ang = ((rng() * 60 + 20) * Math.PI) / 180;
    const lg = ctx.createLinearGradient(0, 0, Math.cos(ang) * out.width, Math.sin(ang) * out.height);
    lg.addColorStop(0, `rgba(255,255,255,${(s.deskLight * 0.55).toFixed(2)})`);
    lg.addColorStop(0.4, `rgba(255,255,255,${(s.deskLight * 0.08).toFixed(2)})`);
    lg.addColorStop(1, `rgba(0,0,0,${(s.deskLight * 0.28).toFixed(2)})`);
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, out.width, out.height);
  }

  // Soft object shadow overcast on the page too
  realisticShadow(out, { ...s, shadowColor: '#000000', shadowOpacity: 0.16, shadowRandom: true, shadowCoverage: 0.7 }, rng, 1);

  vignette(ctx, out.width, out.height, 0.38);
  return out;
}

/** Draw an image into an arbitrary quad by splitting into two affine triangles. */
function drawQuad(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, c: [number, number][]): void {
  const [tl, tr, br, bl] = c;
  const w = img.width;
  const h = img.height;
  tri(ctx, img, [0, 0], [w, 0], [0, h], tl, tr, bl);
  tri(ctx, img, [w, 0], [w, h], [0, h], tr, br, bl);
}
function tri(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  s0: [number, number], s1: [number, number], s2: [number, number],
  d0: [number, number], d1: [number, number], d2: [number, number]
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0[0], d0[1]);
  ctx.lineTo(d1[0], d1[1]);
  ctx.lineTo(d2[0], d2[1]);
  ctx.closePath();
  ctx.clip();
  // Solve affine mapping source→dest for this triangle
  const det = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]) || 1e-6;
  const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / det;
  const bb = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / det;
  const cc = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / det;
  const dd = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / det;
  const e = d0[0] - a * s0[0] - bb * s0[1];
  const f = d0[1] - cc * s0[0] - dd * s0[1];
  ctx.setTransform(a, cc, bb, dd, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.86);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
