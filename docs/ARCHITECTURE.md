# Architecture

A deep technical breakdown of Quilltext's internals.

---

## Overview

Quilltext is a TypeScript application with no framework (no React, no Svelte, no Angular). It uses Vite as the build tool and has exactly one runtime dependency: `jsPDF` for PDF export.

The application is divided into three layers:

1. **Engine** (`src/engine/`) -- Deterministic render core with zero DOM dependencies. Can be reused in Node.js or Web Workers.
2. **State** (`src/state/`) -- Central data store and persistence layer.
3. **UI** (`src/ui/`) -- DOM-based interface that binds to the state and calls the engine.

---

## Directory Layout

```
src/
  engine/
    types.ts       Settings interface, Doc model, page sizes, defaults
    rng.ts         Seeded PRNG (mulberry32) + derived stream
    scribe.ts      Glyph measurement/drawing interface + FontScribe implementation
    layout.ts      Tokenization, mistake injection, line wrapping, pagination
    paint.ts       Paper, ruling, margins, text, strikes, holes, footer, cover page
    effects.ts     Finish passes: shadow, scanner, phone, desk scene
    fonts.ts       Font loading, registration, built-in font catalog
    atlas.ts       Personal handwriting sprite atlas (scan, extract, render)
    exif.ts        EXIF metadata injection for JPEG exports
  state/
    store.ts       Central Settings + Doc + Atlas store with change subscription
    projects.ts    localStorage-backed project/page persistence with autosave
  ui/
    editor.ts      Contenteditable editor, selection ink bar, DOM to Doc model
    panel.ts       Right-side style panel with 40+ controls, dynamically built
    preview.ts     Canvas preview controller (zoom, resize, RAF-scheduled renders)
    exporter.ts    PNG/JPEG/PDF/clipboard export with progress reporting
    wizard.ts      3-step handwriting cloning dialog (template, align, extract)
    chrome.ts      Toasts, confirm dialog, prompts, dropdown menus, theme, mobile tabs, progress bar
    guides.ts      Overlay-based user guide and technical documentation
    tutorial.ts    Interactive product tour with step-by-step highlights
    projectmenu.ts Project and page switcher dropdown menus
  render.ts        The single render pipeline shared by preview and export
  main.ts          Application bootstrap and initialization
  styles.css       All CSS in one file, organized by component
```

---

## Engine Layer

The engine is the heart of Quilltext. It is designed to be framework-free and DOM-independent so it can be reused in other contexts (server-side rendering, Web Workers, etc.).

### `types.ts` -- Document Model

The document model is a simple tree:

```
Doc
  +-- paragraphs: Run[][]    (array of paragraphs)
       +-- Run { text, color }  (array of styled runs per paragraph)
```

`Run.color` is `string | null`. When null, the global ink color from `Settings.inkColor` is used.

`Settings` is a flat interface with approximately 80 properties covering every aspect of the document:

- **Handwriting**: font family, size, ink color, letter/word spacing, baseline wobble
- **Paper**: page size (A4/Letter), paper color, ruling, line spacing, margins, padding, grain
- **Realism**: jitter, ink flow, mistakes (rate + toggle), seed
- **Finish**: mode (none/shadow/scanner/phone/desk), shadow params, phone scene params (perspective, rotation, blur, vignette, white balance, compression), desk scene params
- **Page extras**: punch holes (count, size, sync/spread), watermark/logo (text or image), cover page, signature footer
- **Output**: export scale (1x-4x), JPEG quality

### `rng.ts` -- Seeded Randomness

Uses the **mulberry32** PRNG algorithm. Every random decision in the render pipeline (jitter, ink flow, wobble, mistakes, grain, shadow position, phone rotation) is seeded from `Settings.seed`. Preview and export use the same seed, so they produce identical output.

Key functions:
- `mulberry32(seed)` -- Creates a deterministic RNG function from a 32-bit seed
- `derive(seed, ...salts)` -- Derives a child RNG stream for a specific subsystem, preventing subsystems from consuming each other's random numbers
- `spread(rng)` -- Returns a value uniformly in [-1, 1)

### `scribe.ts` -- Glyph Interface

The `Scribe` interface abstracts glyph measurement and drawing:

```typescript
interface Scribe {
  width(ch: string): number;
  draw(ctx, ch, color, rnd): void;
  readonly sizePx: number;
}
```

Both layout and paint go through this seam. This is what makes WYSIWYG work:
- Layout measures glyph widths through `Scribe.width()` to determine line breaks and pagination
- Paint draws glyphs through `Scribe.draw()` at those exact positions

Two implementations exist:
1. **`FontScribe`** -- Uses Canvas2D `measureText()` and `fillText()` for standard fonts
2. **`AtlasScribe`** -- Uses the personal glyph atlas for cloned handwriting; falls back to `FontScribe` for missing characters

### `layout.ts` -- Layout Pipeline

The layout pipeline has three stages:

#### 1. Tokenization
Each paragraph's runs are flattened into character arrays, then split into word tokens (sequences of non-space characters) and space tokens.

#### 2. Mistake Injection
If `Settings.mistakes` is enabled, eligible words (4+ alphabetic characters) are probabilistically replaced with misspelled versions:
- Truncation (55%): "however" becomes "howe"
- Adjacent letter swap (20%): "because" becomes "becuase"
- Doubled letter (13%): "between" becomes "betweeen"
- Random word from a curated list of common errors (12%)

The original (correct) word is then rendered with a strike-through, followed by the mistake. Because mistakes are injected before measurement, the layout accounts for them exactly. v1 injected them after pagination and silently cropped overflow.

#### 3. Line Wrapping and Pagination
- `computeGeometry()` calculates the content area from page size, margins, padding, and ruling pitch
- Words are placed left-to-right, wrapping when exceeding the available width
- Lines are grouped into pages of `linesPerPage` each
- Maximum 40 pages (`MAX_PAGES`), with a truncation flag

### `paint.ts` -- Rendering

`paintPage()` renders one page onto a `<canvas>`:

1. **Paper** (`paintPaper`):
   - Fill with `paperColor`
   - Grain texture: seeded random speckles and paper fibers
   - Ruling lines at `lineSpacing` pitch
   - Margin lines (left and/or top)
   - Punch holes with subtle shading (radial gradient + shadow arc)
   - Watermark/logo (text or image, positioned and rotated)

2. **Text** (`paintText`):
   - Each token is positioned with per-word jitter (rotation, scale, vertical offset)
   - Each character within a token gets per-character jitter (vertical offset, rotation, size variation)
   - `inkFlow` controls per-glyph opacity variation (simulates pen pressure)
   - `baselineWobble` applies a sinusoidal vertical drift along each line
   - Crossed-out mistakes (`paintStrike`) draw 2-3 overlapping curved strokes

3. **Footer** (`paintFooter`):
   - Signature/identification footer at the bottom of each page
   - Configurable rows with optional split fields (label + underline)

### `effects.ts` -- Finish Passes

After painting, `applyFinish()` runs a finish pass:

- **`none`**: Returns the canvas as-is
- **`shadow`**: Composite shadow with three layers:
  1. Soft directional gradient from a random angle (or fixed angle)
  2. Irregular radial-gradient blobs (simulating object shadows)
  3. Occluder wedge from a random edge (like a hand or phone edge blocking light)
- **`scanner`**: Shadow + increased contrast
- **`phone`**: Full phone-photo simulation:
  1. Off-white paper (not pure white)
  2. Keystone perspective transform (quadrilateral affine warp)
  3. Gaussian blur
  4. Uneven lighting wash (directional exposure gradient)
  5. Per-pixel grain + white balance + exposure adjustment
  6. JPEG compression artifacts (downsample + upsample)
  7. Drop shadow
  8. Vignette (lens falloff)
  9. Edge shadow bars
- **`desk`**: Page on a desk:
  1. Desk background with grain and surface lines
  2. Affine tilt transform
  3. Drop shadow from a random light direction
  4. Directional lighting wash
  5. Vignette

### `fonts.ts` -- Font Management

- 8 built-in Google Fonts loaded via a single CSS import
- `addCustomFont(file)` -- Loads a .ttf/.otf as a `FontFace`, registers it with the browser, and adds it to the in-memory catalog
- `ensureFontLoaded(family, sizePx)` -- Awaits `document.fonts.load()` to prevent the v1 bug where export captured fallback fonts
- `customFonts` -- Session-scoped registry; fonts are not persisted across reloads

### `atlas.ts` -- Handwriting Atlas

The handwriting cloning feature (Stage 1):
- User prints a template sheet with a grid of labeled cells (2 variants per character, covering alphanumeric + punctuation)
- User writes in the cells, photographs the sheet, and uploads the photo
- A 4-point homography (DLT algorithm) warps the photo to match the template geometry
- Each cell is thresholded to extract the ink pixels, bounding-box cropped, and stored as a glyph
- Glyphs are shelf-packed into a sprite sheet (PNG data URL)
- `AtlasScribe` renders glyphs at the target size by scaling them from the atlas, using the tinted-sheet technique (composite `source-in` to recolor ink)

### `exif.ts` -- EXIF Metadata

For JPEG exports with the phone finish, Quilltext injects realistic EXIF metadata:
- 50+ phone profiles spanning Apple, Samsung, Google, Xiaomi, OnePlus, OPPO, vivo, and others (2020-2026 models)
- Scanner device profiles (Canon, Epson, Brother, Fujitsu, HP, Plustek)
- Scanner app profiles (Adobe Scan, CamScanner, Microsoft Lens, Tiny Scanner, etc.)
- Builds a big-endian TIFF/EXIF APP1 segment with Make, Model, Software, DateTime, exposure, ISO, focal length, and lens model
- Timestamps are staggered per-page (42-128 seconds apart, like a real photo burst)

---

## State Layer

### `store.ts` -- Central Store

A singleton `Store` class holds the three pieces of application state:

```typescript
class Store {
  settings: Settings;
  doc: Doc;
  atlas: Atlas | null;
}
```

- `subscribe(fn)` -- Registers a change listener; returns an unsubscribe function
- `emit(kind)` -- Notifies listeners when `settings`, `doc`, `atlas`, or `project` changes
- `set(key, value)` / `patch(partial)` / `replaceSettings(s)` -- Mutate settings and emit
- `setDoc(doc)` -- Update the document
- `setAtlas(data)` -- Load or clear the handwriting atlas
- `getImage(dataURL)` -- Cached image decoder for watermarks (used during rendering)

### `projects.ts` -- Persistence

Projects and pages are serialized to `localStorage`:

- **Project**: meta (name, timestamps) + `ProjectData` (shared settings, assets, history, export metadata)
- **Page**: meta (name, projectId, timestamps) + `PageDataV2` (per-page settings overrides, paragraph content)

Key design decisions:
- **Shared settings + per-page overrides**: Project-wide defaults in `sharedSettings`, individual pages store only the settings that differ (`diffSettings`). Reduces redundancy for multi-page documents.
- **Autosave**: A 600ms debounced save runs on every `settings` or `doc` change
- **History**: Up to 80 entries tracking project creation, page operations, and exports
- **Migration**: Legacy v1 page records (full settings per page) are lazily migrated to v2 format on first read
- **Export metadata**: Each project records its last export (format, page count, finish mode, phone profile) for quick re-export

---

## UI Layer

### `editor.ts` -- Text Editor

A contenteditable `<div>` restricted to two inline concepts: text and ink-color spans.

- **DOM to Doc model**: `parseEditor()` walks the contenteditable DOM tree, collecting text nodes and their computed colors, then splits on newlines into the `Doc` model
- **Doc model to DOM**: `setEditorFromDoc()` renders the `Doc` back into contenteditable HTML
- **Paste handling**: Pasted content is normalized to plain text (prevents HTML injection)
- **Selection ink bar**: When text is selected, clicking a color swatch applies `foreColor` via `document.execCommand()`. Custom color input with range preservation. Swatches are disabled until a non-collapsed selection exists.

### `panel.ts` -- Style Controls

The right-side control panel is built dynamically from a declarative section and control configuration:

```typescript
type Ctl =
  | { kind: 'select'; key: Key; options: () => Option[] }
  | { kind: 'segment'; key: Key; options: Option[] }
  | { kind: 'number'; key: Key; min: number; max: number; step: number }
  | { kind: 'range'; key: Key; min: number; max: number; step: number }
  | { kind: 'toggle'; key: Key }
  | { kind: 'color'; key: Key; swatches?: string[] }
  | { kind: 'text'; key: Key }
  | { kind: 'lines'; key: Key }
  | { kind: 'image'; key: Key }
  | { kind: 'buttons'; buttons: ButtonDef[] }
  // ...
```

Sections (Handwriting, Text & Ink, Paper & Ruling, Margins, Realism, Effects, Page Extras) are collapsible. Each control reads from and writes to `store.settings`, triggering re-renders.

Approximately 690 lines of control definitions covering 40+ settings.

### `preview.ts` -- Preview Canvas

The `PreviewController` manages:
- **Zoom**: Fit-to-width or manual zoom (0.2x-3x)
- **Resize handling**: A `ResizeObserver` on the canvas well triggers re-render at fit zoom
- **RAF scheduling**: Renders are debounced to animation frames; if a render is already in-flight, a pending flag queues one more
- **Scale**: Renders at `zoom * devicePixelRatio` (capped at 2x DPR for performance), with CSS scaling to display size

### `exporter.ts` -- Export Pipeline

Export formats:
1. **PNG/JPEG**: Renders at `settings.exportScale` (1x-4x), converts to Blob, downloads via object URL
2. **PDF**: Renders pages, builds a jsPDF document, fits each canvas preserving aspect ratio (v1 stretched into a fixed box)
3. **Clipboard**: Renders first page, writes to `navigator.clipboard` as PNG

A guard prevents concurrent exports. Progress is reported through the shared progress bar. Phone-finish JPEGs get EXIF metadata injected per-page with staggered timestamps.

### `wizard.ts` -- Handwriting Cloning Wizard

A 3-step dialog:

1. **Print**: User downloads a PNG template sheet with labeled character cells
2. **Photograph**: User uploads a photo; four corner handles are placed and can be dragged to align with the printed fiducial markers
3. **Review**: Extracted glyphs are shown in a sample sentence; user can accept or go back

The wizard is fully client-side:
- `drawTemplate(scale)` -- Generates the template sheet canvas
- `homography(photoCorners, templateCorners)` -- DLT (Direct Linear Transform) solving a system of 8 equations
- `warpPhoto(photo, corners)` -- Applies the homography with nearest-neighbor sampling
- `extractAtlas(warped, name)` -- Thresholds each cell using mean-luminance adaptive threshold, bounds each glyph, packs them into a shelf sprite sheet, and calibrates em size from median x-height

### `chrome.ts` -- Shared UI Components

- `toast(message, kind, ms)` -- Animated toast notifications (info/success/error)
- `confirmDialog(title, body, actionLabel)` -- Modal confirmation dialog
- `promptDialog(title, initial)` -- Modal text input dialog (replaces `window.prompt()`)
- `attachMenu(btn, menu)` -- Dropdown menu with click-away and Escape handling
- `initTheme(btn)` -- Theme toggle (light/dark) with `localStorage` persistence
- `initMobileTabs()` -- Bottom tab bar for responsive mode
- `progress` -- Progress bar singleton (show, update, hide)

---

## Render Pipeline

The pipeline is defined in `src/render.ts`:

```
renderPages(scale)
  |
  +-- await ensureFontLoaded(family, sizePx)
  |
  +-- Create Scribe (FontScribe or AtlasScribe)
  |
  +-- layoutDocument(doc, settings, scribe)
  |   +-- computeGeometry(settings) -> Geometry
  |   +-- tokenizeParagraph(runs, settings, mistakeRng) -> Token[]
  |   +-- Place words onto lines (wrapping)
  |   +-- Slice lines into pages
  |
  +-- For each page (cover first, then content pages):
  |   +-- paintPage(canvas, page, pageIdx, geom, settings, scribe, scale)
  |   |   +-- paintPaper (fill, grain, ruling, margins, holes, logo)
  |   |   +-- paintText (position glyphs with jitter/wobble/flow)
  |   |   +-- paintFooter (signature rows)
  |   +-- applyFinish(canvas, settings, pageIdx)
  |       +-- shadow / scanner / phone / desk
  |
  +-- Return { canvases: HTMLCanvasElement[], layout: LayoutResult }
```

Both preview and export call this same function. The only difference is the `scale` parameter:
- Preview: `zoom * devicePixelRatio` (screen resolution)
- Export: `settings.exportScale` (user-chosen resolution, 1x-4x)

This is the architectural guarantee that preview and output are identical.

---

## Data Flow

```
User types in editor
       |
       v
  editor.ts: parseEditor() -> Doc model
       |
       v
  store.setDoc(doc)
       |
       v
  store.emit('doc')
       |
       v
  preview.schedule()     (RAF-debounced)
       |
       v
  renderPages(scale)
       |
       v
  Paint canvases -> Replace DOM preview
       |
       v
  User presses Export
       |
       v
  renderPages(exportScale)
       |
       v
  Convert to Blob -> Download / Clipboard
```

Settings changes follow the same path through `store.set()` -> `emit('settings')` -> `preview.schedule()`.

---

## Randomness Architecture

Every randomized visual element uses the seeded PRNG system:

```
Settings.seed
  |
  +-- derive(seed, 7)    -> mistake injection
  +-- derive(seed, 11, pageIdx+1) -> paper grain
  +-- derive(seed, 17, pageIdx+1, lineIdx+1, tokIdx+1) -> per-token jitter
  +-- derive(seed, 23, pageIdx+1, lineIdx+1) -> per-line wobble
  +-- derive(seed, 29, pageIdx+1) -> punch holes
  +-- derive(seed, 41, pageIdx+1) -> finish effects
  +-- derive(seed, 53, pageIdx+1) -> phone grain
```

Each subsystem gets its own derived stream so they do not interfere. Changing the seed produces a completely different page; keeping it stable reproduces the exact same output.
