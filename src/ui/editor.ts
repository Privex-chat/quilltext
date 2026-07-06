import { Doc, Run } from '../engine/types';
import { store } from '../state/store';

/**
 * The editor is a contenteditable restricted to two inline concepts: text and
 * ink-color spans. Everything else is normalized away on paste/parse. The DOM
 * is parsed into the Doc model; the canvas renders only from the model, so
 * editor quirks can never corrupt layout (v1 paginated raw innerHTML).
 */

const INK_PRESETS = [
  { color: '#000f55', label: 'Blue' },
  { color: '#1a1a1a', label: 'Black' },
  { color: '#ba3807', label: 'Red' },
  { color: '#1a6b1a', label: 'Green' },
  { color: '#7b00b4', label: 'Purple' },
  { color: '#b8860b', label: 'Gold' },
  { color: '#006080', label: 'Teal' }
];

let editor: HTMLElement;
let suppress = false;

function togglePlaceholder(): void {
  const ph = document.querySelector<HTMLElement>('.editor-placeholder');
  if (ph) ph.classList.toggle('is-visible', !editor.textContent?.trim());
}

export function initEditor(): void {
  editor = document.getElementById('editor')!;

  setEditorFromDoc(store.doc);

  let debounce: number | undefined;
  editor.addEventListener('input', () => {
    if (suppress) return;
    clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      store.setDoc(parseEditor());
      togglePlaceholder();
    }, 120);
  });

  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
  });

  store.subscribe((kind) => {
    if (kind === 'project') setEditorFromDoc(store.doc);
  });

  initInkBar();

  document.getElementById('clear-text-btn')!.addEventListener('click', () => {
    editor.innerHTML = '<div><br></div>';
    store.setDoc({ paragraphs: [[]] });
    togglePlaceholder();
    editor.focus();
  });
}

// ── DOM → Doc ────────────────────────────────────────────────────────────────

function parseEditor(): Doc {
  const flat: Run[] = [];
  let lastWasNewline = true;

  const put = (text: string, color: string | null) => {
    if (!text) return;
    flat.push({ text, color });
    lastWasNewline = text.endsWith('\n');
  };
  const newline = (force = false) => {
    if (force || !lastWasNewline) put('\n', null);
  };

  const isBlock = (el: Element) => /^(DIV|P|LI|H[1-6]|BLOCKQUOTE|PRE)$/.test(el.tagName);

  const walk = (node: Node, color: string | null) => {
    if (node.nodeType === Node.TEXT_NODE) {
      put(node.nodeValue ?? '', color);
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.tagName === 'BR') {
      newline(true);
      return;
    }
    const own = elementColor(node) ?? color;
    if (isBlock(node)) newline();
    node.childNodes.forEach((child) => walk(child, own));
    if (isBlock(node)) newline();
  };

  editor.childNodes.forEach((n) => walk(n, null));

  // Split flat runs on newlines into paragraphs.
  const paragraphs: Run[][] = [[]];
  for (const run of flat) {
    const parts = run.text.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) paragraphs.push([]);
      if (part) paragraphs[paragraphs.length - 1].push({ text: part, color: run.color });
    });
  }
  // A trailing newline shouldn't count as an extra blank line.
  if (paragraphs.length > 1 && paragraphs[paragraphs.length - 1].length === 0) paragraphs.pop();
  return { paragraphs };
}

function elementColor(el: Element): string | null {
  const style = (el as HTMLElement).style?.color;
  if (style) return normalizeColor(style);
  const attr = el.tagName === 'FONT' ? el.getAttribute('color') : null;
  return attr ? normalizeColor(attr) : null;
}

function normalizeColor(c: string): string {
  const m = c.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return c;
  const hex = (v: string) => Number(v).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

// ── Doc → DOM ────────────────────────────────────────────────────────────────

const escapeHtml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function setEditorFromDoc(doc: Doc): void {
  suppress = true;
  const html = doc.paragraphs
    .map((para) => {
      if (!para.length) return '<div><br></div>';
      const inner = para
        .map((r) =>
          r.color
            ? `<span style="color:${escapeHtml(r.color)}">${escapeHtml(r.text)}</span>`
            : escapeHtml(r.text)
        )
        .join('');
      return `<div>${inner}</div>`;
    })
    .join('');
  editor.innerHTML = html || '<div><br></div>';
  suppress = false;
  togglePlaceholder();
}

// ── selection ink bar ────────────────────────────────────────────────────────

function initInkBar(): void {
  const bar = document.getElementById('ink-bar')!;
  const host = document.getElementById('ink-swatches')!;
  const hint = document.getElementById('ink-hint')!;

  for (const p of INK_PRESETS) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.setProperty('--sw', p.color);
    b.title = p.label;
    b.setAttribute('aria-label', `Ink ${p.label}`);
    b.disabled = true;
    // mousedown + preventDefault keeps the editor selection alive
    b.addEventListener('mousedown', (e) => {
      e.preventDefault();
      applyColor(p.color);
    });
    host.appendChild(b);
  }

  const wrap = document.createElement('label');
  wrap.className = 'swatch swatch-custom';
  wrap.title = 'Custom color';
  wrap.innerHTML = '<input type="color" value="#000f55" aria-label="Custom ink color" disabled><span aria-hidden="true">+</span>';
  const custom = wrap.querySelector('input')!;
  let savedRange: Range | null = null;
  custom.addEventListener('mousedown', () => {
    const sel = getSelection();
    savedRange = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  });
  custom.addEventListener('change', () => {
    if (savedRange) {
      const sel = getSelection()!;
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    applyColor(custom.value);
  });
  host.appendChild(wrap);

  const applyColor = (color: string) => {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, color);
    store.setDoc(parseEditor());
  };

  document.addEventListener('selectionchange', () => {
    const sel = getSelection();
    const has =
      !!sel && !sel.isCollapsed && sel.rangeCount > 0 &&
      editor.contains(sel.getRangeAt(0).commonAncestorContainer);
    bar.classList.toggle('has-selection', has);
    host.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach((el) => (el.disabled = !has));
    hint.textContent = has ? 'Pick a color for the selection' : 'Select text to recolor it';
  });
}

export function updateStats(text: string): void {
  const el = document.getElementById('doc-stats')!;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  el.dataset.words = String(words);
  el.textContent = `${words.toLocaleString()} words`;
}

export function appendPageCount(pages: number): void {
  const el = document.getElementById('doc-stats')!;
  const words = el.dataset.words ?? '0';
  el.textContent = `${Number(words).toLocaleString()} words · ${pages} page${pages === 1 ? '' : 's'}`;
}
