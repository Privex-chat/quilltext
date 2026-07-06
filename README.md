<p align="center">
  <img src="public/images/logo.png" alt="Quilltext" width="120">
</p>

<h1 align="center">Quilltext</h1>

<p align="center">
  Turn typed text into pages that look honestly handwritten.<br/>
  Free, open source, no signup, no limits.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-beta-yellow" alt="Beta">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License">
</p>

---

Quilltext is a text-to-handwriting tool built around a single deterministic Canvas2D render engine. Both the live preview and the exported file are drawn by exactly the same code, so what you see is what you get at any resolution.

---

## Important: Collaboration Mode Is Not Implemented

Some descriptions of this project reference a collaborative mode allowing up to 5 members to work simultaneously via a shareable public link. That feature has not been built yet. It requires:

- A proper database backend (server, not just the browser)
- Real-time synchronization infrastructure (WebSockets, CRDTs)
- Authentication and rate-limiting
- Cloud storage for projects and assets

This work is currently under development and testing. The current beta is client-side only. Everything runs in your browser, and your text never leaves your machine. See the [Roadmap](docs/ROADMAP.md) for full details.

---

## Features

| Feature | Status |
|---|---|
| WYSIWYG render engine: single Canvas2D pipeline draws both preview and export | Done |
| 8 built-in handwriting fonts: Homemade Apple, Caveat, Kalam, Patrick Hand, Shadows Into Light, Indie Flower, Liu Jian Mao Cao, Hindi (Kruti Dev) | Done |
| Upload your own fonts: any .ttf or .otf file, fully client-side | Done |
| Clone your own handwriting: print a template sheet, write in the boxes, photograph it, align corners, and Quilltext extracts your glyphs into a sprite atlas | Done |
| Real paper simulation: ruled lines, left/top margins, punch holes, signature footer, cover page, paper grain texture, A4 or Letter | Done |
| Realism controls: per-word/character jitter, ink-flow (pen-pressure) variation, baseline wobble, simulated crossed-out mistakes. All seeded for reproducibility | Done |
| Finishes: clean, drop shadow, flatbed scanner, phone photo (warm tint, grain, tilt, perspective, EXIF metadata), desk shot | Done |
| Per-selection ink color: highlight text in the editor and recolor individual runs | Done |
| Export: PNG, JPEG, multi-page PDF (aspect-correct), copy first page to clipboard. Ctrl/Cmd+S exports PDF | Done |
| Local projects: named projects, pages, autosave, duplicate, switch. Everything lives in localStorage | Done |
| Polished UI: three-pane workbench, light/dark themes, full keyboard access, responsive down to phones | Done |
| Collaborative mode: real-time multi-user editing via shareable links | Not implemented (in development) |
| Cloud project sync: projects synced across devices via a server | Not implemented (in development) |

---

## Quick Start

```bash
npm install
npm run dev        # Vite dev server
npm run build      # TypeScript check + production build to dist/
npm run preview    # Serve the production build
npm run check      # TypeScript check only
```

No framework required. TypeScript + Vite + one bundled dependency (jsPDF) for PDF export. The `src/engine/` folder has zero DOM or UI dependencies and can be reused independently.

---

## Architecture

```
src/
  engine/           Deterministic render core (no UI dependencies)
    types.ts        Settings + Doc model, page sizes, default values
    rng.ts          Seeded PRNG (mulberry32) + derived streams
    scribe.ts       Glyph measurement/drawing seam (fonts + atlas share it)
    layout.ts       Tokenize (+ mistake injection) -> wrap -> paginate, from real metrics
    paint.ts        Paper, ruling, margins, jittered text, strikes, holes, footer, cover page
    effects.ts      Finish passes (drop shadow, scanner, phone photo, desk scene)
    fonts.ts        Font loading, built-in fonts, custom font registration
    atlas.ts        Personal handwriting glyph atlas (scan, extract, render)
    exif.ts         EXIF metadata injection for phone-finish JPEGs
  state/
    store.ts        Central settings/doc/atlas store + change events
    projects.ts     localStorage project/page persistence with autosave
  ui/
    editor.ts       Contenteditable text editor + selection ink bar
    panel.ts        Right-side style control panel (40+ controls)
    preview.ts      Canvas preview with zoom, resize observer, RAF scheduling
    exporter.ts     PNG/JPEG/PDF/clipboard export with progress
    wizard.ts       Handwriting cloning wizard (3-step dialog)
    chrome.ts       Toasts, confirm dialog, dropdown menus, theme, mobile tabs, progress bar
    guides.ts       User guide and technical documentation overlays
    tutorial.ts     Interactive product tour
    projectmenu.ts  Project/page switcher menus
  render.ts         The single pipeline that both preview and export call
  main.ts           Application boot and initialization
  styles.css        All application styles
```

Layout and paint both go through `Scribe`, and preview and export both go through `renderPages(scale)`. Change the scale and you get the same page at a different resolution. This is how WYSIWYG works.

---

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full development roadmap, including detailed status of collaboration mode and other planned features.

---

## Development

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for contribution guidelines and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a deep technical breakdown of the codebase.

---

## Credits

Created by **Hemansh** ([@Privex-chat](https://github.com/Privex-chat)).

Anyone is welcome to view, fork, and reuse the code with permission or proper credits to the original author.

This project is a from-scratch rebuild inspired by the original text-to-handwriting concept. MIT licensed (see [LICENSE](LICENSE)).
