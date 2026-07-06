# Roadmap

**Last updated:** July 2026
**Version:** 2.0.0-beta.1

Quilltext is in active development. This document outlines what exists, what is being worked on, and what is planned for future releases.

---

## Feature Status Overview

### Completed (v2.0.0-beta.1)

- Deterministic Canvas2D render engine (single pipeline for preview and export)
- 8 built-in handwriting fonts
- Custom font upload (.ttf/.otf)
- Handwriting cloning wizard (glyph atlas, fully client-side)
- Paper simulation: ruled lines, margins (left + top), punch holes, signature footer, cover page, paper grain texture
- A4 and Letter page sizes
- Realism controls: jitter, ink flow, baseline wobble, seeded randomness
- Simulated crossed-out mistakes
- Finish effects: drop shadow, flatbed scanner, phone photo, desk scene
- Per-selection ink coloring
- Export: PNG, JPEG, multi-page PDF, clipboard copy
- Keyboard shortcut: Ctrl/Cmd+S for PDF export
- EXIF metadata injection for phone-finish JPEGs (50+ phone profiles + scanner devices)
- Project system: named projects, pages, autosave to localStorage
- Light/dark themes with system preference detection and manual override
- Responsive three-pane UI with mobile tab navigation
- Accessibility: WCAG 2.1 AA baseline, keyboard navigation, screen reader labels
- Inline progress bar during multi-page export
- Toast notification system
- Interactive product tour + user guide

---

### Under Development

These features are actively being worked on but are not yet ready for this beta release.

#### Collaborative Mode (Up to 5 Members via Shareable Link)

**Status:** Not implemented. In design and prototyping phase.

This is the most commonly referenced feature that does not yet exist. The current codebase is entirely client-side with no server component. Collaboration requires:

| Component | Status |
|---|---|
| Backend server architecture | Planning |
| Real-time sync protocol (CRDT/OT via WebSockets) | Research |
| User presence and awareness | Not started |
| Room/workspace management with 5-user cap | Not started |
| Shareable link generation with access control | Not started |
| Rate limiting and abuse prevention | Not started |
| Authentication (anonymous + optional accounts) | Planning |
| Persistent cloud storage for projects | Not started |

The document model in `src/state/projects.ts` already serializes per-document, so it is structurally ready to sync once the backend lands.

#### Cloud Project Sync

**Status:** Not implemented. Depends on collaborative mode infrastructure.

Syncing projects across devices requires the same backend as collaboration. The current project system saves exclusively to localStorage and has no cloud component.

---

### Planned (Future Milestones)

#### ML Handwriting Synthesis (Stage 2)

**Status:** Research phase.

The current handwriting cloning (Stage 1) extracts glyphs from a scanned template sheet into a sprite atlas. Stage 2 will use a lightweight ML model (running server-side or via WebGPU) to synthesize continuous strokes, producing smoother joins between letters and more natural ligatures.

| Component | Status |
|---|---|
| Glyph atlas (Stage 1) | Done |
| ML stroke synthesis model | Research |
| Server endpoint for synthesis | Planning |
| Client-side WebGPU inference | Exploring |

#### Project Folders on Backend

**Status:** Planned. Depends on cloud infrastructure.

When the backend is ready, projects will support:
- Folder organization
- Shared projects (collaborative)
- Version history and undo across sessions
- Asset library (uploaded fonts, watermarks, signatures)

#### Supabase Integration

**Status:** Evaluated but not yet implemented.

The architecture audit identified Supabase as the preferred backend stack:
- PostgreSQL for projects, documents, and user data
- Realtime for WebSocket-based presence and CRDT relay
- Storage for scan images, font files, and glyph atlases
- Row-Level Security for per-user and per-room access control
- Edge Functions for rate-limited endpoints
- Anonymous auth for the no-signup path

This integration will be introduced alongside the collaborative mode beta.

---

## How to Track Progress

- Watch the [GitHub repository](https://github.com/Privex-chat/quilltext/) for release announcements
- Check the issues tab for active development tasks
- Collaboration mode development will be tracked in a dedicated milestone once it begins

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get involved.
