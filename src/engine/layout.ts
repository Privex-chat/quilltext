import { Doc, PAGE_SIZES, Settings } from './types';
import { Scribe } from './scribe';
import { derive, Rng } from './rng';

export interface StyledChar {
  ch: string;
  color: string | null;
}
interface Token {
  chars: StyledChar[];
  strike: boolean;
}

export interface PlacedChar extends StyledChar {
  /** x relative to the line's text-left edge. */
  x: number;
  w: number;
}
export interface PlacedToken {
  x: number;
  w: number;
  strike: boolean;
  chars: PlacedChar[];
}
export interface PlacedLine {
  tokens: PlacedToken[];
}
export interface PageLayout {
  lines: PlacedLine[];
}

export interface Geometry {
  pageW: number;
  pageH: number;
  contentTop: number;
  textLeft: number;
  textRight: number;
  pitch: number;
  firstBaseline: number;
  linesPerPage: number;
  footerTop: number | null;
}

export interface LayoutResult {
  pages: PageLayout[];
  geom: Geometry;
  truncated: boolean;
}

export const MAX_PAGES = 40; // hard cap prevents memory issues

export function computeGeometry(s: Settings): Geometry {
  const { w, h } = PAGE_SIZES[s.pageSize];
  const contentTop = s.marginTop ? s.marginTopHeight : 0;
  const leftEdge = s.marginLeft ? s.marginLeftWidth : 0;
  const textLeft = leftEdge + s.paddingX;
  const textRight = w - s.paddingX;
  const pitch = Math.max(14, s.lineSpacing);
  const footerTop = s.footer ? h - Math.max(60, s.footerHeight) : null;
  const firstBaseline = contentTop + s.paddingTop + pitch;
  const usableBottom = (footerTop ?? h) - 10;
  const linesPerPage = Math.max(1, Math.floor((usableBottom - firstBaseline) / pitch) + 1);
  return { pageW: w, pageH: h, contentTop, textLeft, textRight, pitch, firstBaseline, linesPerPage, footerTop };
}

export const baselineY = (geom: Geometry, lineIdx: number): number =>
  geom.firstBaseline + lineIdx * geom.pitch;

// ── mistake generation (ported from v1, now seeded and pre-layout) ──────────

const WRONG_WORDS = [
  'however', 'therefore', 'although', 'because', 'between', 'through', 'during',
  'before', 'without', 'another', 'different', 'following', 'usually', 'whether',
  'several', 'together', 'example', 'perhaps', 'actually', 'simply'
];

function makeMistake(word: string, rng: Rng): string {
  const r = rng();
  if (r < 0.55 && word.length > 3) {
    const len = Math.max(2, Math.floor(word.length * (0.3 + rng() * 0.4)));
    return word.slice(0, len);
  }
  if (r < 0.75 && word.length > 3) {
    const i = 1 + Math.floor(rng() * (word.length - 2));
    return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
  }
  if (r < 0.88 && word.length > 2) {
    const i = Math.floor(rng() * word.length);
    return word.slice(0, i) + word[i] + word[i] + word.slice(i + 1);
  }
  return WRONG_WORDS[Math.floor(rng() * WRONG_WORDS.length)];
}

// ── tokenization ────────────────────────────────────────────────────────────

const isSpace = (ch: string) => ch === ' ' || ch === '\t' || ch === ' ';

/**
 * Paragraph → word/space tokens. Mistakes are injected HERE, before any
 * measurement, so wrapping and pagination account for them exactly
 * (v1 injected after pagination and cropped the overflow).
 */
function tokenizeParagraph(runs: { text: string; color: string | null }[], s: Settings, mistakeRng: Rng): Token[] {
  const chars: StyledChar[] = [];
  for (const run of runs) {
    for (const ch of run.text) chars.push({ ch, color: run.color });
  }

  const tokens: Token[] = [];
  let i = 0;
  while (i < chars.length) {
    const space = isSpace(chars[i].ch);
    let j = i;
    while (j < chars.length && isSpace(chars[j].ch) === space) j++;
    tokens.push({ chars: chars.slice(i, j), strike: false });
    i = j;
  }

  if (!s.mistakes || s.mistakeRate <= 0) return tokens;

  const out: Token[] = [];
  for (const tok of tokens) {
    const word = tok.chars.map((c) => c.ch).join('');
    const eligible = !isSpace(word[0]) && word.length >= 4 && /[a-zA-Z]{3,}/.test(word);
    if (eligible && mistakeRng() < s.mistakeRate) {
      const mistake = makeMistake(word, mistakeRng);
      const color = tok.chars[0].color;
      out.push({ chars: [...mistake].map((ch) => ({ ch, color })), strike: true });
      out.push({ chars: [{ ch: ' ', color }], strike: false });
    }
    out.push(tok);
  }
  return out;
}

// ── wrapping + pagination ───────────────────────────────────────────────────

export function layoutDocument(doc: Doc, s: Settings, scribe: Scribe): LayoutResult {
  const geom = computeGeometry(s);
  const maxW = Math.max(40, geom.textRight - geom.textLeft);
  const mistakeRng = derive(s.seed, 7);

  const advance = (ch: string) => scribe.width(ch) + s.letterSpacing;
  const spaceW = () => advance(' ') + s.wordSpacing;

  const lines: PlacedLine[] = [];
  let cur: PlacedToken[] = [];
  let x = 0;

  const pushLine = () => {
    lines.push({ tokens: cur });
    cur = [];
    x = 0;
  };

  const placeWord = (tok: Token) => {
    // measure
    let w = 0;
    const placed: PlacedChar[] = tok.chars.map((c) => {
      const cw = advance(c.ch);
      const pc = { ...c, x: w, w: cw };
      w += cw;
      return pc;
    });

    if (x > 0 && x + w > maxW) pushLine();

    if (w > maxW) {
      // Word longer than a line: hard-break by characters.
      let start = 0;
      while (start < placed.length) {
        let end = start;
        let segW = 0;
        while (end < placed.length && (end === start || segW + placed[end].w <= maxW - x)) {
          segW += placed[end].w;
          end++;
        }
        const base = placed[start].x;
        cur.push({
          x, w: segW, strike: tok.strike,
          chars: placed.slice(start, end).map((c) => ({ ...c, x: c.x - base }))
        });
        x += segW;
        start = end;
        if (start < placed.length) pushLine();
      }
      return;
    }

    cur.push({ x, w, strike: tok.strike, chars: placed });
    x += w;
  };

  for (const para of doc.paragraphs) {
    const tokens = tokenizeParagraph(para, s, mistakeRng);
    for (const tok of tokens) {
      if (isSpace(tok.chars[0]?.ch ?? '')) {
        if (x > 0) x += spaceW() * tok.chars.length; // collapse leading spaces
      } else if (tok.chars.length) {
        placeWord(tok);
      }
    }
    pushLine(); // paragraph break (empty paragraph = blank ruled line)
  }

  // Trim trailing blank line produced by the final paragraph break
  if (lines.length && lines[lines.length - 1].tokens.length === 0) lines.pop();

  const pages: PageLayout[] = [];
  for (let i = 0; i < lines.length; i += geom.linesPerPage) {
    if (pages.length >= MAX_PAGES) break;
    pages.push({ lines: lines.slice(i, i + geom.linesPerPage) });
  }
  if (pages.length === 0) pages.push({ lines: [] });

  return { pages, geom, truncated: lines.length > MAX_PAGES * geom.linesPerPage };
}
