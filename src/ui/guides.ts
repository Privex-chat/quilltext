/**
 * User Guide + Technical Docs — interactive modals with collapsible
 * sections and inline SVG illustrations.
 */

// ── SVG helpers (inline, no external deps) ─────────────────────────────

const ICONS = {
  page: `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M10 6h14l8 8v22a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><path d="M24 6v8h8" opacity=".5"/><path d="M13 22h14M13 28h14" stroke-width="2"/></svg>`,
  pen: `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M8 30l-2 6 6-2L32 14l-4-4L8 30Z"/><path d="M28 10l4 4" opacity=".5"/></svg>`,
  paper: `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"><rect x="4" y="3" width="32" height="34" rx="2"/><path d="M4 11h32" stroke-width=".8" opacity=".4"/><path d="M4 15h32" stroke-width=".8" opacity=".4"/><path d="M4 19h32" stroke-width=".8" opacity=".4"/><path d="M4 27h32" stroke-width=".8" opacity=".4"/></svg>`,
  ruler: `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"><rect x="6" y="4" width="28" height="32" rx="2" fill="var(--accent-weak)" opacity=".4"/><path d="M12 10v24M20 10v24M28 10v24" stroke-width=".8"/></svg>`,
  sliders: `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"><path d="M8 10h24M8 20h24M8 30h24"/><circle cx="16" cy="10" r="3" fill="var(--accent-weak)"/><circle cx="26" cy="20" r="3" fill="var(--accent-weak)"/><circle cx="14" cy="30" r="3" fill="var(--accent-weak)"/></svg>`,
  camera: `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M6 12h6l2-4h12l2 4h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Z"/><circle cx="20" cy="22" r="6"/><circle cx="20" cy="22" r="2" fill="var(--accent)"/></svg>`,
  download: `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M8 24v6a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2v-6"/><path d="M20 6v18M14 18l6 6 6-6" stroke-width="2"/></svg>`,
  gear: `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"><circle cx="20" cy="20" r="5"/><path d="M20 2v4M20 34v4M7.03 7.03l2.83 2.83M30.14 30.14l2.83 2.83M2 20h4M34 20h4M7.03 32.97l2.83-2.83M30.14 9.86l2.83-2.83" opacity=".5"/></svg>`,
  layers: `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"><path d="M4 16l16-8 16 8-16 8-16-8Z"/><path d="M4 24l16 8 16-8" opacity=".6"/></svg>`,
};

// ── User Guide content ────────────────────────────────────────────────

const USER_GUIDE_SECTIONS = [
  {
    title: 'Welcome to Quilltext',
    icon: ICONS.page,
    body: `<p>Quilltext transforms typed text into convincing handwritten pages. It handles everything from font choice and paper style to realistic imperfections and photo-grade finishing effects.</p>
<p>No signup required. All processing happens in your browser — your text never leaves your machine.</p>`,
  },
  {
    title: 'Quick start',
    icon: ICONS.pen,
    body: `<ol>
<li>Type or paste text into the <strong>editor</strong> (left panel). The preview updates automatically.</li>
<li>Adjust any setting in the <strong>Style panel</strong> (right panel) — font, paper, margins, realism.</li>
<li>Choose a <strong>Finish effect</strong> to give the page a realistic look (shadow, scanner, phone photo, desk).</li>
<li>Click <strong>Export</strong> (top bar) and choose PNG, JPEG, or PDF.</li>
</ol>`,
  },
  {
    title: 'Handwriting settings',
    icon: ICONS.pen,
    body: `<p><strong>Font</strong> — 8 built-in handwriting fonts: Homemade Apple, Caveat, Kalam, Patrick Hand, Shadows Into Light, Indie Flower, Liu Jian Mao Cao, Hindi Handwriting. Upload your own .ttf/.otf or scan your actual handwriting with the wizard.</p>
<p><strong>Font size</strong> — 8 to 32 pt, in 0.5 pt increments.</p>
<p><strong>Ink color</strong> — 6 preset colors plus a custom color picker. You can also color individual words by selecting text in the editor and picking a swatch from the ink bar.</p>
<p><strong>Letter spacing</strong> — Adjust gap between letters (-2 to 20 px).</p>
<p><strong>Word spacing</strong> — Extra space between words (0 to 40 px).</p>`,
  },
  {
    title: 'Paper & ruling',
    icon: ICONS.paper,
    body: `<p><strong>Page size</strong> — A4 (210 × 297 mm) or Letter (8.5 × 11 in).</p>
<p><strong>Paper color</strong> — White, cream, beige, or light gray. Pick any custom color.</p>
<p><strong>Ruled lines</strong> — Toggle the blue guideline lines on or off. Control spacing (20–64 px), thickness, and color.</p>
<p><strong>Lines under margin</strong> — Extend ruling lines into the left margin area.</p>`,
  },
  {
    title: 'Margins',
    icon: ICONS.ruler,
    body: `<p><strong>Left margin line</strong> — The classic red vertical line. Toggle on/off, adjust width (24–140 px).</p>
<p><strong>Top margin line</strong> — A horizontal header line. Toggle on/off, adjust height (24–140 px).</p>
<p><strong>Margin color</strong> — Customize the margin line color.</p>
<p><strong>First line offset</strong> — Extra space before the first line of text (0–60 px).</p>
<p><strong>Side padding</strong> — Horizontal inset from the page edge (4–60 px).</p>`,
  },
  {
    title: 'Realism',
    icon: ICONS.sliders,
    body: `<p><strong>Handwriting variation</strong> (0–100%) — How irregular the writing looks. Adds per-character jitter in position, size, and rotation.</p>
<p><strong>Ink flow variation</strong> (0–100%) — Simulates pen pressure changes. Characters vary in opacity as if the ink flow is inconsistent.</p>
<p><strong>Baseline wobble</strong> (0–100%) — Makes each line drift up and down naturally, like real handwriting.</p>
<p><strong>Paper grain</strong> (0–100%) — Adds subtle speckle and fiber texture to the paper.</p>
<p><strong>Mistakes</strong> — Crossed-out words with a squiggly strike-through. Control frequency (1–25%). Each mistake is a random type: cut-short word, swapped letters, doubled letter, or wrong word replacement.</p>
<p><strong>Shuffle variation</strong> — Generates a new random seed so every page looks different.</p>`,
  },
  {
    title: 'Finish effects',
    icon: ICONS.camera,
    body: `<p><strong>Clean</strong> — Just the page, no effects.</p>
<p><strong>Shadow</strong> — An overcast shadow falling across the page from one side. Adjustable angle, opacity, and coverage.</p>
<p><strong>Scanner</strong> — Shadow effect plus contrast boost for a scanned-document look.</p>
<p><strong>Phone</strong> — Simulates a smartphone photo of a notebook page. Includes keystone perspective, handheld rotation, white balance, sensor grain, compression artifacts, focus softness, lens vignette, and object shadows. JPEG exports can embed real EXIF metadata (make, model, lens, ISO, exposure) from 50+ profiles including phones, scanner apps, and scanner devices.</p>
<p><strong>Desk</strong> — Places the page on a textured desk surface (wood, dark wood, dark surface, light surface, green mat, blue fabric) with perspective tilt and desk lighting.</p>`,
  },
  {
    title: 'Page extras',
    icon: ICONS.layers,
    body: `<p><strong>Punch holes</strong> — 2 or 3-hole punch pattern on the left (or right) edge. Sync spacing or position each hole individually.</p>
<p><strong>Brand mark / watermark</strong> — Overlay text or an uploaded image anywhere on the page. Adjust size, opacity, rotation, and position.</p>
<p><strong>Cover page</strong> — Add a title page before the content. Customize title, font, ink color, and labeled fields.</p>
<p><strong>Signature footer</strong> — A ruled footer section with label-value rows. Use "|" to split a row into two columns (e.g. "Name: | Date:"). Optionally render labels in the handwriting font.</p>`,
  },
  {
    title: 'Export',
    icon: ICONS.download,
    body: `<p><strong>PNG</strong> — Lossless, one file per page. Best quality, largest file size.</p>
<p><strong>JPEG</strong> — Configurable quality (50–100%). With "Phone" finish, exports include realistic EXIF metadata.</p>
<p><strong>PDF</strong> — Multi-page document, one PDF file. Perfect for sharing or printing.</p>
<p><strong>Copy to clipboard</strong> — First page as PNG, ready to paste.</p>
<p><strong>Resolution</strong> — 1×, 2×, 3×, or 4×. Higher = sharper but larger files. A4 at 2× = 1588 × 2246 px.</p>
<p><strong>Keyboard shortcut</strong> — Ctrl/Cmd+S exports a PDF.</p>`,
  },
  {
    title: 'Handwriting wizard',
    icon: ICONS.pen,
    body: `<p>The <strong>"Clone my handwriting"</strong> wizard lets you digitize your actual handwriting in 3 steps:</p>
<ol>
<li><strong>Print the template</strong> — A grid sheet with target boxes for each character.</li>
<li><strong>Fill and photograph</strong> — Write each character in its box with dark ink in good lighting. Take a photo or scan.</li>
<li><strong>Align and extract</strong> — Upload the photo and drag the 4 corner handles to align the grid. The wizard extracts each glyph, packs it into a sprite sheet, and saves it to your browser.</li>
</ol>
<p>Your scanned handwriting then becomes available as the "My handwriting" font option.</p>`,
  },
];

// ── Technical Docs content ─────────────────────────────────────────────

const TECH_SECTIONS = [
  {
    title: 'Architecture overview',
    icon: ICONS.layers,
    body: `<p>Quilltext follows a strict unidirectional data flow:</p>
<pre>Editor (contentEditable) → Doc model → Layout engine → Paint system → Effects → Canvas</pre>
<p>The <strong>Doc model</strong> is an array of paragraphs, each containing styled Run objects (text + optional color). The <strong>Settings</strong> object holds every configurable parameter (104 fields).</p>
<p>Preview and export share the exact same <code>renderPages(scale)</code> function. Different scale = different resolution. This guarantees WYSIWYG — what you see in the preview is what you get in the download.</p>
<p>All state lives in a singleton <code>Store</code> with subscribe/emit change propagation. Projects persist to localStorage with 600ms debounced autosave.</p>`,
  },
  {
    title: 'Seeded PRNG (mulberry32)',
    icon: ICONS.gear,
    body: `<p>Every source of randomness uses a deterministic <strong>mulberry32</strong> seeded PRNG, not Math.random().</p>
<p>Given the same seed, every page renders identically — across sessions, browsers, and machines.</p>
<pre>function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}</pre>
<p><strong>Child stream derivation</strong> — <code>rng.derive(key)</code> creates an independent sub-generator from a seed and a string key. Each subsystem (jitter, wobble, ink flow, grain, mistakes, shadow angle, phone rotation) gets its own derived stream, so they never interfere.</p>
<p><code>rng.spread()</code> maps uniform [0,1) output to [-1, 1) for symmetric variation.</p>
<p>The "Shuffle" button simply generates a new random seed.</p>`,
  },
  {
    title: 'Layout engine',
    icon: ICONS.ruler,
    body: `<p>The layout pipeline is a pure function: <code>layoutDocument(doc, settings, scribe, rng) → PageLayout[]</code></p>
<p><strong>1. Compute geometry</strong> — Calculate page dimensions from page size, margins, ruling pitch, and padding.</p>
<p><strong>2. Tokenize paragraphs</strong> — Split each paragraph's runs into individual tokens (words). For each token, the mistake injector may modify it before layout (cut-short, swapped letters, doubled letter, or wrong word replacement). Mistakes are seeded and pre-layout so pagination accounts for them.</p>
<p><strong>3. Word wrap</strong> — Place tokens into lines using the Scribe's glyph metrics. The Scribe interface (<code>measureText()</code> / <code>fillText()</code>) abstracts over font rendering so layout and paint share the same measurements.</p>
<p><strong>4. Paginate</strong> — Slice lines into pages. Maximum 40 pages with truncation warning.</p>
<p>Each paragraph gets its own derived RNG stream for reproducible mistakes.</p>`,
  },
  {
    title: 'Paint system',
    icon: ICONS.paper,
    body: `<p><code>paintPage(ctx, layout, settings, rng, scale, pageIndex)</code> renders a single page:</p>
<p><strong>1. Paper</strong> — Fill background color, then draw grain speckles and subtle fiber curves from the derived grain RNG.</p>
<p><strong>2. Ruling lines</strong> — Draw horizontal guidelines at the computed pitch. Lines extend into the margin area if configured.</p>
<p><strong>3. Margins</strong> — Vertical left margin line and/or horizontal top margin line in the configured color.</p>
<p><strong>4. Punch holes</strong> — Circle cutouts at the left (or right) edge, either evenly spaced or at individual positions.</p>
<p><strong>5. Brand mark</strong> — Text or image watermark at the chosen position with opacity, rotation, and scale.</p>
<p><strong>6. Handwritten text</strong> — For each line/token/character: apply baseline wobble (sinusoidal drift), word rotation/scale/offset, per-character vertical jitter, rotation variation, size variation, and ink flow opacity. Seeded variant selection for atlas glyphs. Strike-through for mistakes uses 2-3 overlapping curved strokes.</p>
<p><strong>7. Cover page</strong> — Title with underline and labeled fields rendered at the top of the first page.</p>
<p><strong>8. Signature footer</strong> — Horizontal rule + label-value rows at the bottom of each page.</p>`,
  },
  {
    title: 'Effects pipeline',
    icon: ICONS.camera,
    body: `<p><code>applyFinish(pageCanvas, settings, rng)</code> applies a post-processing effect to each rendered page:</p>
<p><strong>Shadow</strong> — Directional gradient (light to dark) + irregular soft-edged blobs + an occluder wedge, blended over the page. Angle is either random or fixed.</p>
<p><strong>Scanner</strong> — Shadow effect + contrast (S-curve) boost for a scanned-document appearance.</p>
<p><strong>Phone</strong> — Multi-pass effect: keystone perspective warp → rotation → white balance adjustment → sensor grain → JPEG compression artifacts → focus softness (gaussian blur) → object shadows → lens vignette (radial darkening) → edge shading. Each parameter is independently controllable.</p>
<p><strong>Desk</strong> — Composite the page onto a textured desk surface: fill desk background → draw page with perspective transform → desk shadow → desk lighting gradient. 6 surface colors available.</p>`,
  },
  {
    title: 'EXIF metadata injection',
    icon: ICONS.gear,
    body: `<p>When the Phone finish is used with JPEG export, Quilltext builds a real APP1 EXIF segment and injects it into the JPEG byte stream.</p>
<p>50+ profiles are available: phones (iPhone 16 Pro Max, Galaxy S25 Ultra, Pixel 9 Pro, Xiaomi 14, OnePlus 13, Nothing Phone 3a, etc.), scanner apps (Adobe Scan, CamScanner, Microsoft Lens, Scanner Pro), and scanner devices (Canon CanoScan, Epson Perfection, Fujitsu ScanSnap, Brother ADS).</p>
<p>Phone profiles include: Make, Model, FocalLength, FNumber, ISO, and LensModel. Scanner-app profiles carry the same phone hardware metadata but with scanner app software name. Scanner-device profiles omit camera-specific fields (aperture, ISO, exposure) and embed 300 DPI resolution instead of 72.</p>
<p>A DateTimeOriginal timestamp is generated per page with realistic cadence (~15 seconds between pages). The EXIF structure includes: TIFF header, IFD0 (Make, Model, Software, DateTime), ExifIFD (FNumber, ISO, DateTimeOriginal, FocalLength, LensModel, ExposureTime), and the APP1 marker. Written directly as JPEG byte manipulation — no library required.</p>`,
  },
  {
    title: 'Handwriting atlas system',
    icon: ICONS.layers,
    body: `<p>The atlas system digitizes personal handwriting into a glyph sprite sheet:</p>
<p><strong>Capture</strong> — User photographs a printed template with handwritten characters in a grid.</p>
<p><strong>Alignment</strong> — 4-point DLT (Direct Linear Transform) homography maps the photo grid to the reference grid. User drags corner handles for fine alignment.</p>
<p><strong>Extraction</strong> — Each grid cell is thresholded (Otsu-like per-cell adaptive) and the glyph is isolated.</p>
<p><strong>Packing</strong> — Shelf-packing algorithm arranges all extracted glyphs into a single sprite sheet with tinted caching (one sheet per ink color for performance).</p>
<p><strong>Rendering</strong> — <code>AtlasScribe</code> implements the Scribe interface. For known glyphs it draws from the sprite sheet; for unknown glyphs it falls back to <code>FontScribe</code>.</p>
<p><strong>Persistence</strong> — Atlas data is saved to localStorage and restored on app load.</p>`,
  },
  {
    title: 'State management & persistence',
    icon: ICONS.gear,
    body: `<p>The <code>Store</code> singleton holds three pieces of state:</p>
<ul>
<li><strong>Settings</strong> — All 104 configurable parameters</li>
<li><strong>Doc</strong> — The document model (paragraphs of styled runs)</li>
<li><strong>Atlas / AtlasData</strong> — The personal handwriting sprite sheet</li>
</ul>
<p><code>store.subscribe(fn)</code> registers a change listener. <code>store.emit(kind)</code> notifies all listeners with a change type ('settings', 'doc', 'project', 'atlas'). The editor, panel, and preview each subscribe to relevant change types.</p>
<p><strong>Projects system</strong> (state/projects.ts): Full localStorage CRUD. Each project has shared settings, per-page overrides, asset references, a history log, and export metadata. Autosave fires 600 ms after the last change. v1 → v2 migration handles legacy format.</p>
<p><strong>Settings</strong> persistence: <code>saveSettings()</code> serializes to localStorage keyed by project. <code>loadSettings()</code> restores with merges. Per-page overrides form a prototypical chain — page inherits from project which inherits from defaults.</p>`,
  },
];

// ── Modal render ──────────────────────────────────────────────────────

function openGuide(title: string, icon: string, sections: { title: string; icon: string; body: string }[]): void {
  const existing = document.querySelector('.guide');
  if (existing) existing.remove();

  const dlg = document.createElement('dialog');
  dlg.className = 'guide';

  const headIcon = `<span class="guide-head-icon">${icon}</span>`;

  dlg.innerHTML = `
    <div class="guide-head">
      ${headIcon}
      <strong class="guide-head-title">${title}</strong>
      <button class="guide-close" aria-label="Close">&times;</button>
    </div>
    <div class="guide-body">
      ${sections.map((sec, i) => `
        <details class="guide-section" ${i === 0 ? 'open' : ''}>
          <summary>
            <span class="guide-sec-icon">${sec.icon}</span>
            <span class="guide-sec-title">${sec.title}</span>
          </summary>
          <div class="guide-sec-body">${sec.body}</div>
        </details>
      `).join('')}
    </div>
  `;

  dlg.querySelector('.guide-close')!.addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  document.body.appendChild(dlg);
  dlg.showModal();
}

export function openUserGuide(): void {
  openGuide('User Guide', ICONS.page, USER_GUIDE_SECTIONS);
}

export function openTechnicalDocs(): void {
  openGuide('Technical Docs', ICONS.gear, TECH_SECTIONS);
}
