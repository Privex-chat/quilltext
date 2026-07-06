export interface FontOption {
  label: string;
  family: string;
  kind: 'builtin' | 'custom' | 'atlas';
}

export const ATLAS_FAMILY = '@atlas';

export const BUILTIN_FONTS: FontOption[] = [
  { label: 'Homemade Apple', family: 'Homemade Apple', kind: 'builtin' },
  { label: 'Caveat', family: 'Caveat', kind: 'builtin' },
  { label: 'Kalam', family: 'Kalam', kind: 'builtin' },
  { label: 'Patrick Hand', family: 'Patrick Hand', kind: 'builtin' },
  { label: 'Shadows Into Light', family: 'Shadows Into Light', kind: 'builtin' },
  { label: 'Indie Flower', family: 'Indie Flower', kind: 'builtin' },
  { label: 'Liu Jian Mao Cao', family: 'Liu Jian Mao Cao', kind: 'builtin' },
  { label: 'Hindi (Kruti Dev)', family: 'Hindi Handwriting', kind: 'builtin' }
];

/** Session-registered custom fonts. Not persisted across reloads. */
export const customFonts: FontOption[] = [];

/**
 * Resolve fonts before layout/paint so the first render never captures a
 * fallback font (v1's silent wrong-font bug).
 */
export async function ensureFontLoaded(family: string, sizePx: number): Promise<void> {
  if (family === ATLAS_FAMILY) return;
  try {
    await document.fonts.load(`${sizePx}px "${family}"`, 'The quick brown fox 0123');
  } catch {
    /* unknown family: canvas falls back to cursive, layout still self-consistent */
  }
}

let customCount = 0;

export async function addCustomFont(file: File): Promise<FontOption> {
  if (file.size > 8 * 1024 * 1024) throw new Error('Font file is too large (max 8 MB).');
  const buf = await file.arrayBuffer();
  const family = `Custom ${++customCount}`;
  const face = new FontFace(family, buf);
  await face.load(); // throws on invalid/corrupt font data
  document.fonts.add(face);
  const label = (file.name.replace(/\.(ttf|otf|woff2?)$/i, '') || 'My font').slice(0, 28);
  const opt: FontOption = { label: `${label} (uploaded)`, family, kind: 'custom' };
  customFonts.push(opt);
  return opt;
}

export const ptToPx = (pt: number): number => (pt * 4) / 3;
