/** All geometry is in logical px at scale 1, where an A4 page is 794×1123 (96 dpi). */

export type PageSize = 'a4' | 'letter';
export type Finish = 'none' | 'shadow' | 'scanner' | 'phone' | 'desk';
export type PhoneWhiteBalance = 'auto' | 'warm' | 'cool' | 'neutral';

export interface Settings {
  // Handwriting
  fontFamily: string; // CSS family name, or '@atlas' for the personal glyph atlas
  fontSizePt: number;
  inkColor: string;
  letterSpacing: number; // extra px between glyphs
  wordSpacing: number; // extra px between words
  baselineWobble: number; // 0..1, slow drift of the baseline along a line

  // Paper
  pageSize: PageSize;
  paperColor: string;
  ruling: boolean;
  lineSpacing: number; // ruling pitch, px
  lineThickness: number;
  lineColor: string;
  rulingInMargin: boolean; // ruling lines extend into the left margin strip
  marginLeft: boolean;
  marginLeftWidth: number;
  marginTop: boolean;
  marginTopHeight: number;
  marginColor: string;
  paddingTop: number; // extra offset before the first written line
  paddingX: number; // horizontal inset of the text from margins/page edge
  grain: number; // 0..1 paper texture

  // Realism
  jitter: number; // 0..1 word/char irregularity
  inkFlow: number; // 0..1 per-glyph opacity variation (pen pressure)
  mistakes: boolean;
  mistakeRate: number; // probability per eligible word
  seed: number;

  // Finish
  finish: Finish;
  shadowRandom: boolean;
  shadowAngle: number; // deg, used when shadowRandom is off
  shadowOpacity: number; // 0..1
  shadowCoverage: number; // 0..1
  shadowColor: string;
  scanGrain: number; // 0..1, used by phone finish
  phoneProfileId: string;
  phoneMetadata: boolean;
  phoneShadows: boolean;
  phoneShadowIntensity: number; // 0..1
  phonePerspective: number; // 0..1
  phoneRotation: number; // max handheld rotation in degrees
  phoneBlur: number; // 0..1
  phoneCompression: number; // 0..1
  phoneVignette: number; // 0..1
  phoneWhiteBalance: PhoneWhiteBalance;
  phoneExposureBias: number; // -0.3..0.3
  deskColor: string; // desk finish background
  deskTilt: number; // 0..30 deg-ish perspective amount
  deskLight: number; // 0..1

  // Page extras — punch holes
  punchHoles: boolean;
  holesRight: boolean;
  holeCount: number; // 2 or 3
  holeSize: number; // radius px
  holeMargin: number; // px from the side edge
  holeSync: boolean; // symmetric spacing vs individual positions
  holeSpread: number; // 0..1 gap between outermost holes (synced)
  holePositions: number[]; // vertical fraction per hole (unsynced)

  // Page extras — brand mark / watermark
  logo: boolean;
  logoMode: 'text' | 'image';
  logoText: string;
  logoFont: string;
  logoImageData: string | null; // dataURL of an imported watermark
  logoColor: string;
  logoOpacity: number; // 0..1
  logoScale: number; // fraction of page width the mark spans
  logoRotation: number; // deg
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

  // Page extras — cover page
  coverPage: boolean;
  coverTitle: string;
  coverFont: string; // '' = use the handwriting font
  coverFields: string[];
  coverColor: string;

  // Page extras — signature footer
  footer: boolean;
  footerRows: string[]; // '|' in a row splits it into two fields
  footerColor: string;
  footerOpacity: number; // 0..1
  footerScale: number; // font size multiplier
  footerHandwritten: boolean; // use the handwriting font instead of print
  footerHeight: number; // reserved px

  // Output
  exportScale: number; // 1..4 multiplier over logical px
  jpegQuality: number; // 0.5..1
}

export const PAGE_SIZES: Record<PageSize, { w: number; h: number }> = {
  a4: { w: 794, h: 1123 },
  letter: { w: 816, h: 1056 }
};

export function defaultSettings(): Settings {
  return {
    fontFamily: 'Homemade Apple',
    fontSizePt: 15,
    inkColor: '#000f55',
    letterSpacing: 0,
    wordSpacing: 2,
    baselineWobble: 0.35,

    pageSize: 'a4',
    paperColor: '#ffffff',
    ruling: true,
    lineSpacing: 36,
    lineThickness: 1,
    lineColor: '#9db3d6',
    rulingInMargin: true,
    marginLeft: true,
    marginLeftWidth: 56,
    marginTop: true,
    marginTopHeight: 64,
    marginColor: '#e08e8e',
    paddingTop: 6,
    paddingX: 14,
    grain: 0.15,

    jitter: 0.5,
    inkFlow: 0.35,
    mistakes: false,
    mistakeRate: 0.07,
    seed: Math.floor(Math.random() * 1e9),

    finish: 'shadow',
    shadowRandom: true,
    shadowAngle: 45,
    shadowOpacity: 0.28,
    shadowCoverage: 0.55,
    shadowColor: '#000000',
    scanGrain: 0.45,
    phoneProfileId: 'apple-iphone-15-pro',
    phoneMetadata: true,
    phoneShadows: true,
    phoneShadowIntensity: 0.62,
    phonePerspective: 0.58,
    phoneRotation: 1.15,
    phoneBlur: 0.18,
    phoneCompression: 0.18,
    phoneVignette: 0.28,
    phoneWhiteBalance: 'auto',
    phoneExposureBias: 0.04,
    deskColor: '#8b7355',
    deskTilt: 10,
    deskLight: 0.3,

    punchHoles: false,
    holesRight: false,
    holeCount: 2,
    holeSize: 12,
    holeMargin: 34,
    holeSync: true,
    holeSpread: 0.56,
    holePositions: [0.22, 0.78, 0.5],

    logo: false,
    logoMode: 'text',
    logoText: 'EduPress',
    logoFont: 'Arial',
    logoImageData: null,
    logoColor: '#8a8a8f',
    logoOpacity: 0.4,
    logoScale: 0.16,
    logoRotation: 0,
    logoPosition: 'top-right',

    coverPage: false,
    coverTitle: 'Assignment',
    coverFont: '',
    coverFields: ['Subject', 'Topic', 'Name', 'Roll No', 'Class', 'Date'],
    coverColor: '#000f55',

    footer: false,
    footerRows: ['Name:', 'Date: | Roll No:', 'Subject:', "Teacher's Sign:"],
    footerColor: '#464650',
    footerOpacity: 0.9,
    footerScale: 1,
    footerHandwritten: false,
    footerHeight: 140,

    exportScale: 2,
    jpegQuality: 0.92
  };
}

/** Document model: paragraphs of styled runs. `color: null` means "use global ink". */
export interface Run {
  text: string;
  color: string | null;
}
export interface Doc {
  /** Paragraphs, each a list of runs. Empty paragraph = blank line. */
  paragraphs: Run[][];
}

export function docText(doc: Doc): string {
  return doc.paragraphs.map((p) => p.map((r) => r.text).join('')).join('\n');
}

export function docFromText(text: string): Doc {
  return { paragraphs: text.split('\n').map((line) => (line ? [{ text: line, color: null }] : [])) };
}
