import { Settings } from '../engine/types';
import { ATLAS_FAMILY, BUILTIN_FONTS, addCustomFont, customFonts } from '../engine/fonts';
import { clearAtlasData } from '../engine/atlas';
import { PHONE_PROFILES } from '../engine/exif';
import { store } from '../state/store';
import { confirmDialog, toast } from './chrome';

type Key = keyof Settings;
type Show = (s: Settings) => boolean;

interface Base {
  label: string;
  key?: Key;
  when?: Show;
  hint?: string;
}
type Ctl =
  | (Base & { kind: 'select'; key: Key; options: () => { label: string; value: string; font?: string }[] })
  | (Base & { kind: 'segment'; key: Key; options: { label: string; value: string | number }[] })
  | (Base & { kind: 'number'; key: Key; min: number; max: number; step: number; unit?: string })
  | (Base & { kind: 'range'; key: Key; min: number; max: number; step: number; fmt?: (v: number) => string })
  | (Base & { kind: 'toggle'; key: Key })
  | (Base & { kind: 'color'; key: Key; swatches?: string[] })
  | (Base & { kind: 'text'; key: Key; placeholder?: string })
  | (Base & { kind: 'lines'; key: Key; placeholder?: string })
  | (Base & { kind: 'image'; key: Key })
  | (Base & { kind: 'holePositions' })
  | (Base & { kind: 'subhead' })
  | (Base & { kind: 'buttons'; buttons: { label: string; onClick: () => void; danger?: boolean }[] });

const INK_SWATCHES = ['#000f55', '#1a1a1a', '#ba3807', '#1a6b1a', '#7b00b4', '#006080'];

function fontFamilyOptions(includeInherit: boolean): { label: string; value: string; font?: string }[] {
  const opts: { label: string; value: string; font?: string }[] = [];
  if (includeInherit) opts.push({ label: 'Match handwriting', value: '' });
  opts.push(
    { label: 'Arial', value: 'Arial' },
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Courier', value: 'Courier New' },
    { label: 'Impact', value: 'Impact' },
    { label: 'Times', value: 'Times New Roman' }
  );
  for (const f of BUILTIN_FONTS) opts.push({ label: f.label, value: f.family, font: f.family });
  for (const f of customFonts) opts.push({ label: f.label, value: f.family, font: f.family });
  return opts;
}

const POSITION_OPTIONS = [
  { label: 'Top left', value: 'top-left' },
  { label: 'Top right', value: 'top-right' },
  { label: 'Center', value: 'center' },
  { label: 'Bottom left', value: 'bottom-left' },
  { label: 'Bottom right', value: 'bottom-right' }
];
const PHONE_PROFILE_OPTIONS = () =>
  PHONE_PROFILES.map((p) => ({ label: p.label, value: p.id }));
const PHONE_WB_OPTIONS = () => [
  { label: 'Auto', value: 'auto' },
  { label: 'Warm indoor', value: 'warm' },
  { label: 'Cool daylight', value: 'cool' },
  { label: 'Neutral', value: 'neutral' }
];

interface Section {
  title: string;
  open?: boolean;
  ctls: Ctl[];
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function fontOptions(): { label: string; value: string; font?: string }[] {
  const opts: { label: string; value: string; font?: string }[] = [];
  if (store.atlas) opts.push({ label: 'My handwriting (scanned)', value: ATLAS_FAMILY });
  for (const f of BUILTIN_FONTS) opts.push({ label: f.label, value: f.family, font: f.family });
  for (const f of customFonts) opts.push({ label: f.label, value: f.family, font: f.family });
  return opts;
}

function sections(openWizard: () => void): Section[] {
  return [
    {
      title: 'Handwriting',
      open: true,
      ctls: [
        { kind: 'select', key: 'fontFamily', label: 'Font', options: fontOptions },
        {
          kind: 'buttons',
          label: '',
          buttons: [
            { label: store.atlas ? 'Re-scan my handwriting' : 'Clone my handwriting', onClick: openWizard },
            { label: 'Upload font file', onClick: pickFontFile },
            ...(store.atlas
              ? [{
                  label: 'Delete scan',
                  danger: true,
                  onClick: async () => {
                    if (await confirmDialog('Delete handwriting scan?', 'Your scanned glyphs will be removed from this browser.')) {
                      clearAtlasData();
                      await store.setAtlas(null);
                      toast('Handwriting scan deleted.', 'success');
                    }
                  }
                }]
              : [])
          ]
        },
        { kind: 'number', key: 'fontSizePt', label: 'Font size', min: 8, max: 32, step: 0.5, unit: 'pt' },
        {
          kind: 'color', key: 'inkColor', label: 'Ink color',
          swatches: ['#000f55', '#1a1a1a', '#ba3807', '#1a6b1a', '#7b00b4', '#006080']
        },
        { kind: 'number', key: 'letterSpacing', label: 'Letter spacing', min: -2, max: 20, step: 0.5, unit: 'px' },
        { kind: 'number', key: 'wordSpacing', label: 'Word spacing', min: 0, max: 40, step: 0.5, unit: 'px' }
      ]
    },
    {
      title: 'Paper & ruling',
      open: true,
      ctls: [
        {
          kind: 'segment', key: 'pageSize', label: 'Page size',
          options: [{ label: 'A4', value: 'a4' }, { label: 'Letter', value: 'letter' }]
        },
        {
          kind: 'color', key: 'paperColor', label: 'Paper color',
          swatches: ['#ffffff', '#fdfcf3', '#f7f2e5', '#f1efe9']
        },
        { kind: 'toggle', key: 'ruling', label: 'Ruled lines' },
        { kind: 'range', key: 'lineSpacing', label: 'Line spacing', min: 20, max: 64, step: 1, fmt: (v) => `${v}px`, when: (s) => s.ruling },
        { kind: 'number', key: 'lineThickness', label: 'Line thickness', min: 0.5, max: 3, step: 0.5, unit: 'px', when: (s) => s.ruling },
        { kind: 'color', key: 'lineColor', label: 'Line color', swatches: ['#9db3d6', '#b9c6de', '#c8c8cf', '#d7c4a3'], when: (s) => s.ruling },
        { kind: 'toggle', key: 'rulingInMargin', label: 'Lines under margin', when: (s) => s.ruling && s.marginLeft }
      ]
    },
    {
      title: 'Margins',
      ctls: [
        { kind: 'toggle', key: 'marginLeft', label: 'Left margin line' },
        { kind: 'range', key: 'marginLeftWidth', label: 'Left margin width', min: 24, max: 140, step: 1, fmt: (v) => `${v}px`, when: (s) => s.marginLeft },
        { kind: 'toggle', key: 'marginTop', label: 'Top margin line' },
        { kind: 'range', key: 'marginTopHeight', label: 'Top margin height', min: 24, max: 140, step: 1, fmt: (v) => `${v}px`, when: (s) => s.marginTop },
        { kind: 'color', key: 'marginColor', label: 'Margin color', swatches: ['#e08e8e', '#d44c4c', '#9db3d6', '#c8c8cf'] },
        { kind: 'range', key: 'paddingTop', label: 'First line offset', min: 0, max: 60, step: 1, fmt: (v) => `${v}px` },
        { kind: 'range', key: 'paddingX', label: 'Side padding', min: 4, max: 60, step: 1, fmt: (v) => `${v}px` }
      ]
    },
    {
      title: 'Realism',
      open: true,
      ctls: [
        { kind: 'range', key: 'jitter', label: 'Handwriting variation', min: 0, max: 1, step: 0.05, fmt: pct },
        { kind: 'range', key: 'inkFlow', label: 'Ink flow variation', min: 0, max: 1, step: 0.05, fmt: pct },
        { kind: 'range', key: 'baselineWobble', label: 'Baseline wobble', min: 0, max: 1, step: 0.05, fmt: pct },
        { kind: 'range', key: 'grain', label: 'Paper grain', min: 0, max: 1, step: 0.05, fmt: pct },
        { kind: 'toggle', key: 'mistakes', label: 'Mistakes', hint: 'Randomly cross out words and replace them' },
        { kind: 'range', key: 'mistakeRate', label: 'Mistake frequency', min: 0.01, max: 0.25, step: 0.01, fmt: pct, when: (s) => s.mistakes },
        {
          kind: 'buttons',
          label: '',
          buttons: [{ label: 'Shuffle variation', onClick: () => store.set('seed', Math.floor(Math.random() * 1e9)) }]
        }
      ]
    },
    {
      title: 'Finish',
      ctls: [
        {
          kind: 'segment', key: 'finish', label: 'Effect',
          options: [
            { label: 'Clean', value: 'none' },
            { label: 'Shadow', value: 'shadow' },
            { label: 'Scanner', value: 'scanner' },
            { label: 'Phone', value: 'phone' },
            { label: 'Desk', value: 'desk' }
          ]
        },
        { kind: 'toggle', key: 'shadowRandom', label: 'Random light angle', when: (s) => s.finish === 'shadow' || s.finish === 'scanner' },
        { kind: 'number', key: 'shadowAngle', label: 'Light angle', min: 0, max: 360, step: 5, unit: '°', when: (s) => (s.finish === 'shadow' || s.finish === 'scanner') && !s.shadowRandom },
        { kind: 'range', key: 'shadowOpacity', label: 'Shadow opacity', min: 0, max: 0.9, step: 0.02, fmt: pct, when: (s) => s.finish === 'shadow' || s.finish === 'scanner' },
        { kind: 'range', key: 'shadowCoverage', label: 'Shadow coverage', min: 0.05, max: 1, step: 0.05, fmt: pct, when: (s) => s.finish === 'shadow' || s.finish === 'scanner' },
        { kind: 'select', key: 'phoneProfileId', label: 'Phone model', options: PHONE_PROFILE_OPTIONS, when: (s) => s.finish === 'phone' },
        { kind: 'toggle', key: 'phoneMetadata', label: 'Embed phone metadata', hint: 'JPEG exports use this make, model, lens, exposure and ISO', when: (s) => s.finish === 'phone' },
        { kind: 'select', key: 'phoneWhiteBalance', label: 'White balance', options: PHONE_WB_OPTIONS, when: (s) => s.finish === 'phone' },
        { kind: 'range', key: 'phoneExposureBias', label: 'Exposure bias', min: -0.3, max: 0.3, step: 0.02, fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`, when: (s) => s.finish === 'phone' },
        { kind: 'range', key: 'scanGrain', label: 'Sensor grain', min: 0, max: 1, step: 0.05, fmt: pct, when: (s) => s.finish === 'phone' },
        { kind: 'range', key: 'phoneCompression', label: 'Compression artifacts', min: 0, max: 1, step: 0.05, fmt: pct, when: (s) => s.finish === 'phone' },
        { kind: 'range', key: 'phoneBlur', label: 'Focus softness', min: 0, max: 1, step: 0.05, fmt: pct, when: (s) => s.finish === 'phone' },
        { kind: 'range', key: 'phonePerspective', label: 'Camera perspective', min: 0, max: 1, step: 0.05, fmt: pct, when: (s) => s.finish === 'phone' },
        { kind: 'range', key: 'phoneRotation', label: 'Handheld rotation', min: 0, max: 3, step: 0.05, fmt: (v) => `${v.toFixed(1)}°`, when: (s) => s.finish === 'phone' },
        { kind: 'range', key: 'phoneVignette', label: 'Lens vignette', min: 0, max: 1, step: 0.05, fmt: pct, when: (s) => s.finish === 'phone' },
        { kind: 'toggle', key: 'phoneShadows', label: 'Shadows', hint: 'Adds irregular object and overcast shadows like a real desk photo', when: (s) => s.finish === 'phone' },
        { kind: 'range', key: 'phoneShadowIntensity', label: 'Shadow intensity', min: 0, max: 1, step: 0.05, fmt: pct, when: (s) => s.finish === 'phone' && s.phoneShadows },
        {
          kind: 'select', key: 'deskColor', label: 'Desk surface', when: (s) => s.finish === 'desk',
          options: () => [
            { label: 'Wood desk', value: '#8b7355' },
            { label: 'Dark wood', value: '#5c3a1e' },
            { label: 'Dark surface', value: '#4a4a4a' },
            { label: 'Light surface', value: '#e0e0e0' },
            { label: 'Green mat', value: '#2d5a27' },
            { label: 'Blue fabric', value: '#1a237e' }
          ]
        },
        { kind: 'range', key: 'deskTilt', label: 'Camera tilt', min: 0, max: 30, step: 1, fmt: (v) => `${v}°`, when: (s) => s.finish === 'desk' },
        { kind: 'range', key: 'deskLight', label: 'Light intensity', min: 0, max: 1, step: 0.05, fmt: pct, when: (s) => s.finish === 'desk' }
      ]
    },
    {
      title: 'Page extras',
      ctls: [
        // ── punch holes ──
        { kind: 'subhead', label: 'Punch holes' },
        { kind: 'toggle', key: 'punchHoles', label: 'Punch holes' },
        {
          kind: 'segment', key: 'holeCount', label: 'Number of holes',
          options: [{ label: '2', value: 2 }, { label: '3', value: 3 }], when: (s) => s.punchHoles
        },
        { kind: 'toggle', key: 'holesRight', label: 'On the right edge', when: (s) => s.punchHoles },
        { kind: 'toggle', key: 'holeSync', label: 'Space evenly', hint: 'Turn off to position each hole', when: (s) => s.punchHoles },
        { kind: 'range', key: 'holeSpread', label: 'Spacing', min: 0, max: 1, step: 0.02, fmt: pct, when: (s) => s.punchHoles && s.holeSync },
        { kind: 'holePositions', label: 'Hole positions', when: (s) => s.punchHoles && !s.holeSync },
        { kind: 'range', key: 'holeSize', label: 'Hole size', min: 6, max: 20, step: 0.5, fmt: (v) => `${v}px`, when: (s) => s.punchHoles },
        { kind: 'range', key: 'holeMargin', label: 'Distance from edge', min: 16, max: 90, step: 1, fmt: (v) => `${v}px`, when: (s) => s.punchHoles },

        // ── brand mark / watermark ──
        { kind: 'subhead', label: 'Brand mark / watermark' },
        { kind: 'toggle', key: 'logo', label: 'Show brand mark' },
        {
          kind: 'segment', key: 'logoMode', label: 'Type',
          options: [{ label: 'Text', value: 'text' }, { label: 'Image', value: 'image' }], when: (s) => s.logo
        },
        { kind: 'text', key: 'logoText', label: 'Text', placeholder: 'Brand name', when: (s) => s.logo && s.logoMode === 'text' },
        { kind: 'select', key: 'logoFont', label: 'Font', options: () => fontFamilyOptions(false), when: (s) => s.logo && s.logoMode === 'text' },
        { kind: 'color', key: 'logoColor', label: 'Color', swatches: ['#8a8a8f', '#000000', '#000f55', '#ba3807'], when: (s) => s.logo && s.logoMode === 'text' },
        { kind: 'image', key: 'logoImageData', label: 'Watermark image', when: (s) => s.logo && s.logoMode === 'image' },
        { kind: 'select', key: 'logoPosition', label: 'Position', options: () => POSITION_OPTIONS, when: (s) => s.logo },
        { kind: 'range', key: 'logoScale', label: 'Size', min: 0.04, max: 0.8, step: 0.01, fmt: pct, when: (s) => s.logo },
        { kind: 'range', key: 'logoOpacity', label: 'Opacity', min: 0.05, max: 1, step: 0.05, fmt: pct, when: (s) => s.logo },
        { kind: 'range', key: 'logoRotation', label: 'Rotation', min: -90, max: 90, step: 1, fmt: (v) => `${v}°`, when: (s) => s.logo },

        // ── cover page ──
        { kind: 'subhead', label: 'Cover page' },
        { kind: 'toggle', key: 'coverPage', label: 'Add cover page' },
        { kind: 'text', key: 'coverTitle', label: 'Title', placeholder: 'Assignment', when: (s) => s.coverPage },
        { kind: 'select', key: 'coverFont', label: 'Font', options: () => fontFamilyOptions(true), when: (s) => s.coverPage },
        { kind: 'color', key: 'coverColor', label: 'Ink', swatches: INK_SWATCHES, when: (s) => s.coverPage },
        { kind: 'lines', key: 'coverFields', label: 'Fields (one per line)', when: (s) => s.coverPage },

        // ── signature footer ──
        { kind: 'subhead', label: 'Signature footer' },
        { kind: 'toggle', key: 'footer', label: 'Signature footer' },
        { kind: 'lines', key: 'footerRows', label: 'Rows (one per line, “|” splits a row)', when: (s) => s.footer },
        { kind: 'toggle', key: 'footerHandwritten', label: 'Handwritten labels', when: (s) => s.footer },
        { kind: 'color', key: 'footerColor', label: 'Color', swatches: ['#464650', '#000000', '#000f55', '#ba3807'], when: (s) => s.footer },
        { kind: 'range', key: 'footerOpacity', label: 'Opacity', min: 0.2, max: 1, step: 0.05, fmt: pct, when: (s) => s.footer },
        { kind: 'range', key: 'footerScale', label: 'Text size', min: 0.7, max: 1.8, step: 0.05, fmt: pct, when: (s) => s.footer },
        { kind: 'range', key: 'footerHeight', label: 'Footer height', min: 80, max: 260, step: 5, fmt: (v) => `${v}px`, when: (s) => s.footer }
      ]
    },
    {
      title: 'Output',
      ctls: [
        {
          kind: 'segment', key: 'exportScale', label: 'Resolution',
          options: [
            { label: '1×', value: 1 },
            { label: '2×', value: 2 },
            { label: '3×', value: 3 },
            { label: '4×', value: 4 }
          ],
          hint: 'A4 at 2× is 1588 × 2246 px'
        },
        { kind: 'range', key: 'jpegQuality', label: 'JPEG quality', min: 0.5, max: 1, step: 0.02, fmt: pct }
      ]
    }
  ];
}

// ── rendering + binding ──────────────────────────────────────────────────────

let host: HTMLElement;
let openWizardFn: () => void;
const visUpdaters: (() => void)[] = [];
const valueUpdaters: (() => void)[] = [];

export function initPanel(openWizard: () => void): void {
  host = document.getElementById('controls')!;
  openWizardFn = openWizard;
  build();
  store.subscribe((kind) => {
    if (kind === 'settings' || kind === 'project') {
      for (const f of valueUpdaters) f();
      for (const f of visUpdaters) f();
    }
    if (kind === 'atlas') build(); // font list + scan buttons change shape
  });
}

function build(): void {
  visUpdaters.length = 0;
  valueUpdaters.length = 0;
  const frag = document.createDocumentFragment();

  for (const sec of sections(openWizardFn)) {
    const details = document.createElement('details');
    details.className = 'ctl-group';
    details.dataset.section = sec.title.toLowerCase().replace(/[^a-z]/g, '');
    if (sec.open) details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = sec.title;
    details.appendChild(summary);
    const list = document.createElement('div');
    list.className = 'ctl-list';
    for (const ctl of sec.ctls) list.appendChild(renderCtl(ctl));
    details.appendChild(list);
    frag.appendChild(details);
  }
  host.replaceChildren(frag);
  for (const f of visUpdaters) f();
}

function row(ctl: Ctl): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ctl-row';
  if (ctl.when) {
    const w = ctl.when;
    visUpdaters.push(() => (el.hidden = !w(store.settings)));
  }
  return el;
}

function labelEl(ctl: Ctl, forId?: string): HTMLElement {
  const l = document.createElement(forId ? 'label' : 'span');
  l.className = 'ctl-label';
  l.textContent = ctl.label;
  if (forId) (l as HTMLLabelElement).htmlFor = forId;
  return l;
}

function hintEl(text?: string): HTMLElement | null {
  if (!text) return null;
  const h = document.createElement('p');
  h.className = 'ctl-hint';
  h.textContent = text;
  return h;
}

let uid = 0;
const nextId = () => `ctl-${++uid}`;

function renderCtl(ctl: Ctl): HTMLElement {
  const el = row(ctl);

  switch (ctl.kind) {
    case 'select': {
      const id = nextId();
      const select = document.createElement('select');
      select.id = id;
      const populate = () => {
        select.innerHTML = '';
        for (const o of ctl.options()) {
          const opt = document.createElement('option');
          opt.value = String(o.value);
          opt.textContent = o.label;
          if (o.font) opt.style.fontFamily = `"${o.font}", cursive`;
          select.appendChild(opt);
        }
        select.value = String(store.settings[ctl.key]);
      };
      populate();
      select.addEventListener('change', () => store.set(ctl.key, select.value as never));
      valueUpdaters.push(() => {
        populate();
      });
      el.append(labelEl(ctl, id), select);
      break;
    }

    case 'segment': {
      const group = document.createElement('div');
      group.className = 'segment';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', ctl.label);
      const btns: HTMLButtonElement[] = [];
      for (const o of ctl.options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = o.label;
        b.addEventListener('click', () => store.set(ctl.key, o.value as never));
        btns.push(b);
        group.appendChild(b);
      }
      const sync = () =>
        btns.forEach((b, i) => {
          const active = String(store.settings[ctl.key]) === String(ctl.options[i].value);
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', String(active));
        });
      sync();
      valueUpdaters.push(sync);
      el.append(labelEl(ctl), group);
      const h = hintEl(ctl.hint);
      if (h) el.appendChild(h);
      break;
    }

    case 'number': {
      const id = nextId();
      const wrap = document.createElement('div');
      wrap.className = 'num-wrap';
      if (ctl.unit) wrap.dataset.unit = ctl.unit;
      const input = document.createElement('input');
      input.type = 'number';
      input.id = id;
      Object.assign(input, { min: String(ctl.min), max: String(ctl.max), step: String(ctl.step) });
      input.value = String(store.settings[ctl.key]);
      input.addEventListener('input', () => {
        const v = clampNum(parseFloat(input.value), ctl.min, ctl.max);
        if (!Number.isNaN(v)) store.set(ctl.key, v as never);
      });
      input.addEventListener('blur', () => (input.value = String(store.settings[ctl.key])));
      valueUpdaters.push(() => {
        if (document.activeElement !== input) input.value = String(store.settings[ctl.key]);
      });
      wrap.appendChild(input);
      el.append(labelEl(ctl, id), wrap);
      break;
    }

    case 'range': {
      const id = nextId();
      const wrap = document.createElement('div');
      wrap.className = 'range-wrap';
      const input = document.createElement('input');
      input.type = 'range';
      input.id = id;
      input.min = String(ctl.min);
      input.max = String(ctl.max);
      input.step = String(ctl.step);
      input.value = String(store.settings[ctl.key]);
      const val = document.createElement('span');
      val.className = 'range-val';
      const fmt = ctl.fmt ?? ((v: number) => String(v));
      const paint = () => (val.textContent = fmt(Number(store.settings[ctl.key])));
      paint();
      input.addEventListener('input', () => {
        store.set(ctl.key, parseFloat(input.value) as never);
        paint();
      });
      valueUpdaters.push(() => {
        if (document.activeElement !== input) input.value = String(store.settings[ctl.key]);
        paint();
      });
      wrap.append(input, val);
      el.append(labelEl(ctl, id), wrap);
      break;
    }

    case 'toggle': {
      const id = nextId();
      const lab = document.createElement('label');
      lab.className = 'toggle-row';
      lab.htmlFor = id;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      input.className = 'toggle-input';
      input.checked = Boolean(store.settings[ctl.key]);
      input.addEventListener('change', () => store.set(ctl.key, input.checked as never));
      valueUpdaters.push(() => (input.checked = Boolean(store.settings[ctl.key])));
      const knob = document.createElement('span');
      knob.className = 'toggle-knob';
      knob.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'ctl-label';
      text.textContent = ctl.label;
      lab.append(text, input, knob);
      el.appendChild(lab);
      const h = hintEl(ctl.hint);
      if (h) el.appendChild(h);
      break;
    }

    case 'color': {
      const wrap = document.createElement('div');
      wrap.className = 'colors';
      const current = () => String(store.settings[ctl.key]);
      const btns: HTMLElement[] = [];
      for (const sw of ctl.swatches ?? []) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch';
        b.style.setProperty('--sw', sw);
        b.setAttribute('aria-label', `${ctl.label} ${sw}`);
        b.addEventListener('click', () => store.set(ctl.key, sw as never));
        btns.push(b);
        wrap.appendChild(b);
      }
      const custom = document.createElement('input');
      custom.type = 'color';
      custom.className = 'swatch swatch-picker';
      custom.setAttribute('aria-label', `${ctl.label} custom`);
      custom.value = toHex6(current());
      custom.addEventListener('input', () => store.set(ctl.key, custom.value as never));
      wrap.appendChild(custom);
      const sync = () => {
        btns.forEach((b) =>
          b.classList.toggle('is-active', b.style.getPropertyValue('--sw') === current())
        );
        if (document.activeElement !== custom) custom.value = toHex6(current());
      };
      sync();
      valueUpdaters.push(sync);
      el.append(labelEl(ctl), wrap);
      break;
    }

    case 'text': {
      const id = nextId();
      const input = document.createElement('input');
      input.type = 'text';
      input.id = id;
      if (ctl.placeholder) input.placeholder = ctl.placeholder;
      input.value = String(store.settings[ctl.key] ?? '');
      input.addEventListener('input', () => store.set(ctl.key, input.value as never));
      valueUpdaters.push(() => {
        if (document.activeElement !== input) input.value = String(store.settings[ctl.key] ?? '');
      });
      el.append(labelEl(ctl, id), input);
      break;
    }

    case 'lines': {
      const id = nextId();
      const ta = document.createElement('textarea');
      ta.className = 'ctl-textarea';
      ta.id = id;
      ta.rows = 3;
      if (ctl.placeholder) ta.placeholder = ctl.placeholder;
      const arr = () => (store.settings[ctl.key] as unknown as string[]) ?? [];
      ta.value = arr().join('\n');
      ta.addEventListener('input', () => {
        store.set(ctl.key, ta.value.split('\n').filter((l) => l.trim() !== '') as never);
      });
      valueUpdaters.push(() => {
        if (document.activeElement !== ta) ta.value = arr().join('\n');
      });
      el.append(labelEl(ctl, id), ta);
      break;
    }

    case 'image': {
      const wrap = document.createElement('div');
      wrap.className = 'image-ctl';
      const thumb = document.createElement('div');
      thumb.className = 'image-thumb';
      const btnRow = document.createElement('div');
      btnRow.className = 'btn-row';
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'btn';
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'btn btn-ghost btn-danger-text';
      clear.textContent = 'Remove';
      const paint = () => {
        const data = store.settings[ctl.key] as unknown as string | null;
        thumb.style.backgroundImage = data ? `url(${data})` : 'none';
        thumb.classList.toggle('is-empty', !data);
        pick.textContent = data ? 'Replace image' : 'Choose image';
        clear.hidden = !data;
      };
      pick.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
        input.addEventListener('change', () => {
          const file = input.files?.[0];
          if (!file) return;
          if (file.size > 4 * 1024 * 1024) {
            toast('Image is too large (max 4 MB).', 'error');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => store.set(ctl.key, String(reader.result) as never);
          reader.onerror = () => toast('That image could not be read.', 'error');
          reader.readAsDataURL(file);
        });
        input.click();
      });
      clear.addEventListener('click', () => store.set(ctl.key, null as never));
      paint();
      valueUpdaters.push(paint);
      btnRow.append(pick, clear);
      wrap.append(thumb, btnRow);
      el.append(labelEl(ctl), wrap);
      break;
    }

    case 'holePositions': {
      const wrap = document.createElement('div');
      wrap.className = 'hole-pos';
      const build = () => {
        wrap.innerHTML = '';
        const n = Math.max(2, Math.min(3, store.settings.holeCount));
        for (let i = 0; i < n; i++) {
          const lbl = document.createElement('span');
          lbl.className = 'ctl-hint';
          lbl.textContent = `Hole ${i + 1}`;
          const rowWrap = document.createElement('div');
          rowWrap.className = 'range-wrap';
          const input = document.createElement('input');
          input.type = 'range';
          input.min = '0.04';
          input.max = '0.96';
          input.step = '0.01';
          input.value = String(store.settings.holePositions[i] ?? (i + 1) / (n + 1));
          const val = document.createElement('span');
          val.className = 'range-val';
          const paint = () => (val.textContent = pct(parseFloat(input.value)));
          paint();
          input.addEventListener('input', () => {
            const cur = [...store.settings.holePositions];
            while (cur.length < n) cur.push(0.5);
            cur[i] = parseFloat(input.value);
            store.set('holePositions', cur as never);
            paint();
          });
          rowWrap.append(input, val);
          wrap.append(lbl, rowWrap);
        }
      };
      build();
      valueUpdaters.push(() => {
        if (!wrap.contains(document.activeElement)) build();
      });
      el.append(labelEl(ctl), wrap);
      break;
    }

    case 'subhead': {
      el.className = 'ctl-subhead';
      const s = document.createElement('span');
      s.textContent = ctl.label;
      el.appendChild(s);
      break;
    }

    case 'buttons': {
      const wrap = document.createElement('div');
      wrap.className = 'btn-row';
      for (const b of ctl.buttons) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = b.danger ? 'btn btn-ghost btn-danger-text' : 'btn';
        btn.textContent = b.label;
        btn.addEventListener('click', b.onClick);
        wrap.appendChild(btn);
      }
      el.appendChild(wrap);
      break;
    }
  }
  return el;
}

const clampNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function toHex6(c: string): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : '#000f55';
}

function pickFontFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.ttf,.otf,.woff,.woff2';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const opt = await addCustomFont(file);
      store.set('fontFamily', opt.family);
      build();
      toast(`Font "${opt.label}" added. It lives in this session only, so re-upload it after a reload.`, 'success', 5200);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That font file could not be read.', 'error');
    }
  });
  input.click();
}
