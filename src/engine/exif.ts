/**
 * Minimal EXIF writer: injects an APP1 segment into a JPEG so a "phone" export
 * carries believable camera metadata (Make / Model / DateTime / exposure).
 * Big-endian ('MM') TIFF, IFD0 + Exif sub-IFD. Enough fields that a viewer or
 * "Get Info" panel shows a real phone, without pretending to be a full library.
 */

export interface PhoneProfile {
  id: string;
  label: string;
  make: string;
  model: string;
  software: string;
  lens?: string;
  fNumber: [number, number];
  exposure: [number, number]; // seconds
  iso: number;
  focal: [number, number]; // mm
  dpi?: number; // for scanner devices (default 72)
}

// 50+ phones + scanning apps + scanner devices in circulation (2020-2026).
export const PHONE_PROFILES: PhoneProfile[] = [
  // ── Apple iPhone ──────────────────────────────────────────────
  { id: 'apple-iphone-15-pro', label: 'iPhone 15 Pro', make: 'Apple', model: 'iPhone 15 Pro', software: '17.4.1', lens: 'iPhone 15 Pro back triple camera 6.765mm f/1.78', fNumber: [178, 100], exposure: [1, 120], iso: 64, focal: [677, 100] },
  { id: 'apple-iphone-14', label: 'iPhone 14', make: 'Apple', model: 'iPhone 14', software: '17.2', lens: 'iPhone 14 back dual camera 5.7mm f/1.5', fNumber: [15, 10], exposure: [1, 100], iso: 80, focal: [57, 10] },
  { id: 'apple-iphone-13', label: 'iPhone 13', make: 'Apple', model: 'iPhone 13', software: '16.6', lens: 'iPhone 13 back dual camera 5.1mm f/1.6', fNumber: [16, 10], exposure: [1, 90], iso: 100, focal: [51, 10] },
  { id: 'apple-iphone-12', label: 'iPhone 12', make: 'Apple', model: 'iPhone 12', software: '16.3.1', fNumber: [16, 10], exposure: [1, 60], iso: 125, focal: [42, 10] },
  { id: 'apple-iphone-11', label: 'iPhone 11', make: 'Apple', model: 'iPhone 11', software: '15.7', fNumber: [18, 10], exposure: [1, 50], iso: 160, focal: [426, 100] },
  { id: 'apple-iphone-se-3', label: 'iPhone SE', make: 'Apple', model: 'iPhone SE', software: '16.5', fNumber: [18, 10], exposure: [1, 60], iso: 100, focal: [399, 100] },
  { id: 'apple-iphone-16-pro-max', label: 'iPhone 16 Pro Max', make: 'Apple', model: 'iPhone 16 Pro Max', software: '19.0', lens: 'iPhone 16 Pro Max back triple camera 6.9mm f/1.78', fNumber: [178, 100], exposure: [1, 120], iso: 50, focal: [690, 100] },
  { id: 'apple-iphone-16-pro', label: 'iPhone 16 Pro', make: 'Apple', model: 'iPhone 16 Pro', software: '19.0', lens: 'iPhone 16 Pro back triple camera 6.765mm f/1.78', fNumber: [178, 100], exposure: [1, 120], iso: 50, focal: [677, 100] },
  { id: 'apple-iphone-16', label: 'iPhone 16', make: 'Apple', model: 'iPhone 16', software: '19.0', lens: 'iPhone 16 back dual camera 5.7mm f/1.6', fNumber: [16, 10], exposure: [1, 100], iso: 80, focal: [57, 10] },
  { id: 'apple-iphone-15', label: 'iPhone 15', make: 'Apple', model: 'iPhone 15', software: '18.2', lens: 'iPhone 15 back dual camera 5.7mm f/1.6', fNumber: [16, 10], exposure: [1, 90], iso: 80, focal: [57, 10] },
  { id: 'apple-iphone-14-pro', label: 'iPhone 14 Pro', make: 'Apple', model: 'iPhone 14 Pro', software: '17.0', lens: 'iPhone 14 Pro back triple camera 6.86mm f/1.78', fNumber: [178, 100], exposure: [1, 100], iso: 64, focal: [686, 100] },
  { id: 'apple-iphone-13-pro', label: 'iPhone 13 Pro', make: 'Apple', model: 'iPhone 13 Pro', software: '16.0', lens: 'iPhone 13 Pro back triple camera 5.7mm f/1.5', fNumber: [15, 10], exposure: [1, 80], iso: 80, focal: [57, 10] },

  // ── Samsung Galaxy ────────────────────────────────────────────
  { id: 'samsung-galaxy-s23-ultra', label: 'Samsung Galaxy S23 Ultra', make: 'samsung', model: 'SM-S918B', software: 'S918BXXU2AWG1', fNumber: [17, 10], exposure: [1, 100], iso: 50, focal: [64, 10] },
  { id: 'samsung-galaxy-s23', label: 'Samsung Galaxy S23', make: 'samsung', model: 'SM-S911B', software: 'S911BXXU1AWB6', fNumber: [18, 10], exposure: [1, 120], iso: 50, focal: [63, 10] },
  { id: 'samsung-galaxy-a53', label: 'Samsung Galaxy A53', make: 'samsung', model: 'SM-A536B', software: 'A536BXXU4BWD1', fNumber: [18, 10], exposure: [1, 50], iso: 64, focal: [58, 10] },
  { id: 'samsung-galaxy-s21', label: 'Samsung Galaxy S21', make: 'samsung', model: 'SM-G991B', software: 'G991BXXU5DVK1', fNumber: [18, 10], exposure: [1, 60], iso: 80, focal: [54, 10] },
  { id: 'samsung-galaxy-s25-ultra', label: 'Samsung Galaxy S25 Ultra', make: 'samsung', model: 'SM-S938B', software: 'One UI 7.0', fNumber: [17, 10], exposure: [1, 120], iso: 50, focal: [64, 10] },
  { id: 'samsung-galaxy-s25', label: 'Samsung Galaxy S25', make: 'samsung', model: 'SM-S931B', software: 'One UI 7.0', fNumber: [18, 10], exposure: [1, 100], iso: 50, focal: [54, 10] },
  { id: 'samsung-galaxy-s24-ultra', label: 'Samsung Galaxy S24 Ultra', make: 'samsung', model: 'SM-S928B', software: 'One UI 6.1', fNumber: [17, 10], exposure: [1, 100], iso: 50, focal: [63, 10] },
  { id: 'samsung-galaxy-s24', label: 'Samsung Galaxy S24', make: 'samsung', model: 'SM-S921B', software: 'One UI 6.1', fNumber: [18, 10], exposure: [1, 80], iso: 64, focal: [54, 10] },
  { id: 'samsung-galaxy-a55', label: 'Samsung Galaxy A55', make: 'samsung', model: 'SM-A556B', software: 'One UI 6.1', fNumber: [18, 10], exposure: [1, 60], iso: 80, focal: [54, 10] },
  { id: 'samsung-galaxy-z-fold-6', label: 'Samsung Galaxy Z Fold 6', make: 'samsung', model: 'SM-F956B', software: 'One UI 6.1', fNumber: [18, 10], exposure: [1, 80], iso: 64, focal: [52, 10] },
  { id: 'samsung-galaxy-z-flip-6', label: 'Samsung Galaxy Z Flip 6', make: 'samsung', model: 'SM-F741B', software: 'One UI 6.1', fNumber: [18, 10], exposure: [1, 80], iso: 64, focal: [54, 10] },

  // ── Google Pixel ──────────────────────────────────────────────
  { id: 'google-pixel-8', label: 'Google Pixel 8', make: 'Google', model: 'Pixel 8', software: 'HDR+ 1.0.540270994', fNumber: [168, 100], exposure: [1, 110], iso: 55, focal: [69, 10] },
  { id: 'google-pixel-7', label: 'Google Pixel 7', make: 'Google', model: 'Pixel 7', software: 'HDR+ 1.0.470293674', fNumber: [185, 100], exposure: [1, 90], iso: 61, focal: [681, 100] },
  { id: 'google-pixel-6a', label: 'Google Pixel 6a', make: 'Google', model: 'Pixel 6a', software: 'HDR+ 1.0.420351', fNumber: [173, 100], exposure: [1, 66], iso: 84, focal: [44, 10] },
  { id: 'google-pixel-9-pro', label: 'Google Pixel 9 Pro', make: 'Google', model: 'Pixel 9 Pro', software: 'HDR+ 1.0.620490211', fNumber: [168, 100], exposure: [1, 110], iso: 42, focal: [69, 10] },
  { id: 'google-pixel-9', label: 'Google Pixel 9', make: 'Google', model: 'Pixel 9', software: 'HDR+ 1.0.620490211', fNumber: [168, 100], exposure: [1, 90], iso: 48, focal: [64, 10] },
  { id: 'google-pixel-8a', label: 'Google Pixel 8a', make: 'Google', model: 'Pixel 8a', software: 'HDR+ 1.0.540270994', fNumber: [173, 100], exposure: [1, 80], iso: 60, focal: [64, 10] },

  // ── Xiaomi ────────────────────────────────────────────────────
  { id: 'xiaomi-redmi-note-11', label: 'Xiaomi Redmi Note 11', make: 'Xiaomi', model: '2201123G', software: 'MIUI 14', fNumber: [19, 10], exposure: [1, 80], iso: 100, focal: [58, 10] },
  { id: 'xiaomi-redmi-note-12', label: 'Xiaomi Redmi Note 12', make: 'Xiaomi', model: '23021RAA2Y', software: 'MIUI 14', fNumber: [18, 10], exposure: [1, 50], iso: 125, focal: [51, 10] },
  { id: 'xiaomi-14', label: 'Xiaomi 14', make: 'Xiaomi', model: '23127PN0CC', software: 'HyperOS 1.0', fNumber: [16, 10], exposure: [1, 100], iso: 50, focal: [65, 10] },
  { id: 'xiaomi-redmi-note-13-pro', label: 'Xiaomi Redmi Note 13 Pro', make: 'Xiaomi', model: '2312DRAABI', software: 'MIUI 15', fNumber: [165, 100], exposure: [1, 60], iso: 64, focal: [60, 10] },

  // ── OnePlus ───────────────────────────────────────────────────
  { id: 'oneplus-11', label: 'OnePlus 11', make: 'OnePlus', model: 'CPH2449', software: 'OxygenOS 13', fNumber: [18, 10], exposure: [1, 100], iso: 64, focal: [61, 10] },
  { id: 'oneplus-9-pro', label: 'OnePlus 9 Pro', make: 'OnePlus', model: 'LE2123', software: 'OxygenOS 12', fNumber: [188, 100], exposure: [1, 90], iso: 100, focal: [681, 100] },
  { id: 'oneplus-13', label: 'OnePlus 13', make: 'OnePlus', model: 'CPH2653', software: 'OxygenOS 15', fNumber: [16, 10], exposure: [1, 100], iso: 50, focal: [64, 10] },
  { id: 'oneplus-12', label: 'OnePlus 12', make: 'OnePlus', model: 'CPH2583', software: 'OxygenOS 14', fNumber: [16, 10], exposure: [1, 100], iso: 50, focal: [61, 10] },

  // ── OPPO ──────────────────────────────────────────────────────
  { id: 'oppo-reno8', label: 'OPPO Reno8', make: 'OPPO', model: 'CPH2451', software: 'ColorOS 13', fNumber: [188, 100], exposure: [1, 66], iso: 102, focal: [583, 100] },
  { id: 'oppo-find-x8', label: 'OPPO Find X8', make: 'OPPO', model: 'CPH2659', software: 'ColorOS 15', fNumber: [16, 10], exposure: [1, 100], iso: 50, focal: [66, 10] },
  { id: 'oppo-reno-12-pro', label: 'OPPO Reno 12 Pro', make: 'OPPO', model: 'CPH2629', software: 'ColorOS 14', fNumber: [188, 100], exposure: [1, 80], iso: 64, focal: [56, 10] },

  // ── vivo ──────────────────────────────────────────────────────
  { id: 'vivo-v29', label: 'vivo V29', make: 'vivo', model: 'V2312', software: 'Funtouch OS 14', fNumber: [188, 100], exposure: [1, 60], iso: 91, focal: [559, 100] },
  { id: 'vivo-x200-pro', label: 'vivo X200 Pro', make: 'vivo', model: 'V2413', software: 'Funtouch OS 15', fNumber: [157, 100], exposure: [1, 120], iso: 40, focal: [68, 10] },
  { id: 'vivo-v40', label: 'vivo V40', make: 'vivo', model: 'V2418', software: 'Funtouch OS 15', fNumber: [188, 100], exposure: [1, 80], iso: 64, focal: [59, 10] },

  // ── Other brands ──────────────────────────────────────────────
  { id: 'motorola-moto-g-2023', label: 'motorola moto g (2023)', make: 'motorola', model: 'moto g (2023)', software: 'Android 13', fNumber: [18, 10], exposure: [1, 50], iso: 130, focal: [46, 10] },
  { id: 'nothing-phone-3a', label: 'Nothing Phone (3a)', make: 'Nothing', model: 'A059', software: 'Nothing OS 3.0', fNumber: [188, 100], exposure: [1, 80], iso: 64, focal: [57, 10] },
  { id: 'nothing-phone-2', label: 'Nothing Phone (2)', make: 'Nothing', model: 'A065', software: 'Nothing OS 2.5', fNumber: [188, 100], exposure: [1, 80], iso: 64, focal: [56, 10] },
  { id: 'honor-magic-6-pro', label: 'HONOR Magic 6 Pro', make: 'HONOR', model: 'BVL-AN16', software: 'MagicOS 8.0', fNumber: [14, 10], exposure: [1, 100], iso: 50, focal: [66, 10] },
  { id: 'asus-zenfone-11-ultra', label: 'ASUS Zenfone 11 Ultra', make: 'ASUS', model: 'ASUS_AI2501', software: 'Android 14', fNumber: [19, 10], exposure: [1, 80], iso: 64, focal: [56, 10] },
  { id: 'sony-xperia-1-vi', label: 'Sony Xperia 1 VI', make: 'Sony', model: 'XQ-EC72', software: 'Android 14', fNumber: [19, 10], exposure: [1, 100], iso: 50, focal: [59, 10] },
  { id: 'huawei-p60-pro', label: 'Huawei P60 Pro', make: 'HUAWEI', model: 'MNA-AL00', software: 'HarmonyOS 3.1', fNumber: [14, 10], exposure: [1, 80], iso: 50, focal: [66, 10] },

  // ── Scanner apps (phone + scanner app software) ────────────────
  { id: 'apple-iphone-15-pro-adobe-scan', label: 'iPhone 15 Pro (Adobe Scan)', make: 'Apple', model: 'iPhone 15 Pro', software: 'Adobe Scan 25.01', lens: 'iPhone 15 Pro back triple camera 6.765mm f/1.78', fNumber: [178, 100], exposure: [1, 90], iso: 80, focal: [677, 100] },
  { id: 'apple-iphone-15-pro-scanner-pro', label: 'iPhone 15 Pro (Scanner Pro)', make: 'Apple', model: 'iPhone 15 Pro', software: 'Scanner Pro 8.0', lens: 'iPhone 15 Pro back triple camera 6.765mm f/1.78', fNumber: [178, 100], exposure: [1, 80], iso: 100, focal: [677, 100] },
  { id: 'samsung-galaxy-s24-camscanner', label: 'Galaxy S24 (CamScanner)', make: 'samsung', model: 'SM-S921B', software: 'CamScanner 6.8', fNumber: [18, 10], exposure: [1, 60], iso: 100, focal: [54, 10] },
  { id: 'samsung-galaxy-s24-microsoft-lens', label: 'Galaxy S24 (Microsoft Lens)', make: 'samsung', model: 'SM-S921B', software: 'Microsoft Lens 2.0', fNumber: [18, 10], exposure: [1, 60], iso: 100, focal: [54, 10] },
  { id: 'google-pixel-9-google-drive-scan', label: 'Pixel 9 (Google Drive Scan)', make: 'Google', model: 'Pixel 9', software: 'Google Drive 2.25', fNumber: [168, 100], exposure: [1, 60], iso: 80, focal: [64, 10] },
  { id: 'apple-iphone-14-tiny-scanner', label: 'iPhone 14 (Tiny Scanner)', make: 'Apple', model: 'iPhone 14', software: 'Tiny Scanner 3.0', lens: 'iPhone 14 back dual camera 5.7mm f/1.5', fNumber: [15, 10], exposure: [1, 66], iso: 120, focal: [57, 10] },

  // ── Scanner devices (flatbed + document scanners) ──────────────
  { id: 'canon-canoscan-lide-400', label: 'Canon CanoScan LiDE 400', make: 'Canon', model: 'CanoScan LiDE 400', software: 'Canon ScanGear', fNumber: [0, 0], exposure: [0, 0], iso: 0, focal: [0, 0], dpi: 300 },
  { id: 'epson-perfection-v600', label: 'Epson Perfection V600', make: 'Epson', model: 'Perfection V600', software: 'Epson Scan 2', fNumber: [0, 0], exposure: [0, 0], iso: 0, focal: [0, 0], dpi: 300 },
  { id: 'brother-ads-1700w', label: 'Brother ADS-1700W', make: 'Brother', model: 'ADS-1700W', software: 'Brother iPrint&Scan', fNumber: [0, 0], exposure: [0, 0], iso: 0, focal: [0, 0], dpi: 300 },
  { id: 'fujitsu-scansnap-ix1600', label: 'Fujitsu ScanSnap iX1600', make: 'Fujitsu', model: 'ScanSnap iX1600', software: 'ScanSnap Home', fNumber: [0, 0], exposure: [0, 0], iso: 0, focal: [0, 0], dpi: 300 },
  { id: 'hp-scanjet-pro-2500', label: 'HP ScanJet Pro 2500', make: 'HP', model: 'ScanJet Pro 2500', software: 'HP Scan', fNumber: [0, 0], exposure: [0, 0], iso: 0, focal: [0, 0], dpi: 300 },
  { id: 'plustek-escan-a250', label: 'Plustek eScan A250', make: 'Plustek', model: 'eScan A250', software: 'Plustek Scan', fNumber: [0, 0], exposure: [0, 0], iso: 0, focal: [0, 0], dpi: 300 }
];

export const DEFAULT_PHONE_PROFILE_ID = PHONE_PROFILES[0].id;

export function getPhoneProfile(id: string | null | undefined): PhoneProfile {
  return PHONE_PROFILES.find((p) => p.id === id) ?? PHONE_PROFILES[0];
}

// EXIF tag ids
const T = {
  Make: 0x010f, Model: 0x0110, Orientation: 0x0112, XRes: 0x011a, YRes: 0x011b,
  ResUnit: 0x0128, Software: 0x0131, DateTime: 0x0132, YCbCrPos: 0x0213, ExifPtr: 0x8769,
  ExposureTime: 0x829a, FNumber: 0x829d, ISO: 0x8827, ExifVersion: 0x9000,
  DateTimeOriginal: 0x9003, DateTimeDigitized: 0x9004, FocalLength: 0x920a, LensModel: 0xa434
} as const;

const TYPE = { ASCII: 2, SHORT: 3, LONG: 4, RATIONAL: 5, UNDEFINED: 7 } as const;

interface Field {
  tag: number;
  type: number;
  values: number[] | string; // string for ASCII/UNDEFINED
}

function fieldCount(f: Field): number {
  if (typeof f.values === 'string') return f.values.length + (f.type === TYPE.ASCII ? 1 : 0);
  return f.type === TYPE.RATIONAL ? f.values.length / 2 : f.values.length;
}
function fieldByteLen(f: Field): number {
  const c = fieldCount(f);
  switch (f.type) {
    case TYPE.ASCII:
    case TYPE.UNDEFINED: return c;
    case TYPE.SHORT: return c * 2;
    case TYPE.LONG: return c * 4;
    case TYPE.RATIONAL: return c * 8;
    default: return c;
  }
}

/**
 * Serialize one IFD at absolute offset `ifdOffset` (from TIFF start). Overflow
 * data goes into a trailing area starting at `dataStart`. `nextOffset` is the
 * pointer written after the entries (0 = last IFD).
 */
function serializeIFD(fields: Field[], ifdOffset: number, dataStart: number, nextOffset: number): { ifd: Uint8Array; data: Uint8Array } {
  const n = fields.length;
  const ifd = new Uint8Array(2 + n * 12 + 4);
  const dv = new DataView(ifd.buffer);
  dv.setUint16(0, n, false);

  const dataChunks: Uint8Array[] = [];
  let dataLen = 0;

  fields.forEach((f, i) => {
    const off = 2 + i * 12;
    dv.setUint16(off, f.tag, false);
    dv.setUint16(off + 2, f.type, false);
    dv.setUint32(off + 4, fieldCount(f), false);

    const bytes = encodeValues(f);
    if (bytes.length <= 4) {
      for (let k = 0; k < bytes.length; k++) ifd[off + 8 + k] = bytes[k];
    } else {
      const padded = bytes.length % 2 ? concat(bytes, new Uint8Array([0])) : bytes;
      dv.setUint32(off + 8, dataStart + dataLen, false);
      dataChunks.push(padded);
      dataLen += padded.length;
    }
  });

  dv.setUint32(2 + n * 12, nextOffset, false);
  void ifdOffset;
  return { ifd, data: concatAll(dataChunks) };
}

function encodeValues(f: Field): Uint8Array {
  if (f.type === TYPE.ASCII) {
    const s = f.values as string;
    const out = new Uint8Array(s.length + 1);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  }
  if (f.type === TYPE.UNDEFINED) {
    const s = f.values as string;
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  }
  const vals = f.values as number[];
  if (f.type === TYPE.SHORT) {
    const out = new Uint8Array(vals.length * 2);
    const dv = new DataView(out.buffer);
    vals.forEach((v, i) => dv.setUint16(i * 2, v, false));
    return out;
  }
  if (f.type === TYPE.LONG) {
    const out = new Uint8Array(vals.length * 4);
    const dv = new DataView(out.buffer);
    vals.forEach((v, i) => dv.setUint32(i * 4, v >>> 0, false));
    return out;
  }
  // RATIONAL: pairs of LONG (num, den)
  const out = new Uint8Array((vals.length / 2) * 8);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < vals.length; i += 2) {
    dv.setUint32((i / 2) * 8, vals[i] >>> 0, false);
    dv.setUint32((i / 2) * 8 + 4, vals[i + 1] >>> 0, false);
  }
  return out;
}

const concat = (a: Uint8Array, b: Uint8Array) => concatAll([a, b]);
function concatAll(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

function exifDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Build the full APP1 segment bytes (including the 0xFFE1 marker + length). */
function buildApp1(p: PhoneProfile, when: Date): Uint8Array {
  const dt = exifDate(when);
  const dpi = p.dpi ?? 72;

  const exifFields: Field[] = [
    ...(p.exposure[0] !== 0 || p.exposure[1] !== 0 ? [{ tag: T.ExposureTime, type: TYPE.RATIONAL, values: p.exposure } as Field] : []),
    ...(p.fNumber[0] !== 0 || p.fNumber[1] !== 0 ? [{ tag: T.FNumber, type: TYPE.RATIONAL, values: p.fNumber } as Field] : []),
    ...(p.iso > 0 ? [{ tag: T.ISO, type: TYPE.SHORT, values: [p.iso] } as Field] : []),
    { tag: T.ExifVersion, type: TYPE.UNDEFINED, values: '0231' },
    { tag: T.DateTimeOriginal, type: TYPE.ASCII, values: dt },
    { tag: T.DateTimeDigitized, type: TYPE.ASCII, values: dt },
    ...(p.focal[0] !== 0 || p.focal[1] !== 0 ? [{ tag: T.FocalLength, type: TYPE.RATIONAL, values: p.focal } as Field] : []),
    ...(p.lens ? [{ tag: T.LensModel, type: TYPE.ASCII, values: p.lens } as Field] : [])
  ];

  // Layout: [TIFF header 8] [IFD0] [IFD0 data] [ExifIFD] [ExifIFD data]
  const ifd0Fields = (exifPtr: number): Field[] => [
    { tag: T.Make, type: TYPE.ASCII, values: p.make },
    { tag: T.Model, type: TYPE.ASCII, values: p.model },
    { tag: T.Orientation, type: TYPE.SHORT, values: [1] },
    { tag: T.XRes, type: TYPE.RATIONAL, values: [dpi, 1] },
    { tag: T.YRes, type: TYPE.RATIONAL, values: [dpi, 1] },
    { tag: T.ResUnit, type: TYPE.SHORT, values: [2] },
    { tag: T.Software, type: TYPE.ASCII, values: p.software },
    { tag: T.DateTime, type: TYPE.ASCII, values: dt },
    { tag: T.YCbCrPos, type: TYPE.SHORT, values: [1] },
    { tag: T.ExifPtr, type: TYPE.LONG, values: [exifPtr] }
  ];

  const ifd0Size = 2 + ifd0Fields(0).length * 12 + 4;
  const ifd0DataLen = ifd0Fields(0).reduce((s, f) => {
    const b = fieldByteLen(f);
    return s + (b > 4 ? b + (b % 2) : 0);
  }, 0);
  const exifIfdOffset = 8 + ifd0Size + ifd0DataLen;

  const ifd0 = serializeIFD(ifd0Fields(exifIfdOffset), 8, 8 + ifd0Size, 0);
  const exifDataStart = exifIfdOffset + (2 + exifFields.length * 12 + 4);
  const exifIfd = serializeIFD(exifFields, exifIfdOffset, exifDataStart, 0);

  const tiff = new Uint8Array(8);
  const tdv = new DataView(tiff.buffer);
  tiff[0] = 0x4d; tiff[1] = 0x4d; // 'MM' big-endian
  tdv.setUint16(2, 0x002a, false);
  tdv.setUint32(4, 8, false); // IFD0 at offset 8

  const tiffBlock = concatAll([tiff, ifd0.ifd, ifd0.data, exifIfd.ifd, exifIfd.data]);
  const header = new Uint8Array(6);
  header.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"

  const payload = concatAll([header, tiffBlock]);
  const segLen = payload.length + 2; // APP1 length includes the length field itself
  const app1 = new Uint8Array(2 + 2 + payload.length);
  app1[0] = 0xff; app1[1] = 0xe1;
  app1[2] = (segLen >> 8) & 0xff;
  app1[3] = segLen & 0xff;
  app1.set(payload, 4);
  return app1;
}

/** Insert the EXIF APP1 segment right after SOI (0xFFD8). Returns a new JPEG. */
export function injectExif(jpeg: Uint8Array, profile: PhoneProfile, when = new Date()): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg; // not a JPEG, leave as-is
  const app1 = buildApp1(profile, when);
  return concatAll([jpeg.slice(0, 2), app1, jpeg.slice(2)]);
}

/** Self-check: build EXIF, confirm structure + that "Exif" and the model survive. */
export function _selfCheck(): boolean {
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const p = PHONE_PROFILES[0];
  const out = injectExif(fakeJpeg, p);
  const asStr = String.fromCharCode(...out);
  const okMarkers = out[0] === 0xff && out[1] === 0xd8 && out[2] === 0xff && out[3] === 0xe1;
  const okExif = asStr.includes('Exif');
  const okModel = asStr.includes(p.model);
  const okTail = out[out.length - 2] === 0xff && out[out.length - 1] === 0xd9;
  return okMarkers && okExif && okModel && okTail;
}
