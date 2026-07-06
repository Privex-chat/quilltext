import { PAGE_SIZES, docText } from '../engine/types';
import { renderPages } from '../render';
import { store } from '../state/store';
import { updateStats, appendPageCount } from './editor';
import { toast } from './chrome';

class PreviewController {
  private well!: HTMLElement;
  private host!: HTMLElement;
  private zoomLabel!: HTMLElement;
  private zoom: 'fit' | number = 'fit';
  private busy = false;
  private pending = false;
  private warnedTruncation = false;

  init(): void {
    this.well = document.getElementById('well')!;
    this.host = document.getElementById('pages')!;
    this.zoomLabel = document.getElementById('zoom-level')!;

    document.getElementById('zoom-in')!.addEventListener('click', () => this.nudgeZoom(+0.1));
    document.getElementById('zoom-out')!.addEventListener('click', () => this.nudgeZoom(-0.1));
    document.getElementById('zoom-fit')!.addEventListener('click', () => {
      this.zoom = 'fit';
      this.schedule();
    });

    new ResizeObserver(() => {
      if (this.zoom === 'fit') this.schedule();
    }).observe(this.well);

    store.subscribe(() => this.schedule());
    this.schedule();
  }

  private cssScale(): number {
    if (this.zoom !== 'fit') return this.zoom;
    const pageW = PAGE_SIZES[store.settings.pageSize].w;
    const avail = Math.max(240, this.well.clientWidth - 72);
    return Math.min(1.6, Math.max(0.2, avail / pageW));
  }

  private nudgeZoom(delta: number): void {
    const cur = this.cssScale();
    this.zoom = Math.min(3, Math.max(0.2, Math.round((cur + delta) * 10) / 10));
    this.schedule();
  }

  schedule(): void {
    if (this.busy) {
      this.pending = true;
      return;
    }
    this.busy = true;
    requestAnimationFrame(() => void this.render());
  }

  private async render(): Promise<void> {
    try {
      const cssScale = this.cssScale();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { canvases, layout } = await renderPages(cssScale * dpr);

      const frag = document.createDocumentFragment();
      canvases.forEach((canvas, i) => {
        const fig = document.createElement('figure');
        fig.className = 'page';
        canvas.style.width = `${canvas.width / dpr}px`;
        canvas.style.height = 'auto';
        const cap = document.createElement('figcaption');
        cap.textContent =
          store.settings.coverPage && i === 0 ? 'Cover' : `Page ${store.settings.coverPage ? i : i + 1}`;
        fig.append(canvas, cap);
        frag.appendChild(fig);
      });
      this.host.replaceChildren(frag);

      updateStats(docText(store.doc));
      appendPageCount(canvases.length);
      this.zoomLabel.textContent = `${Math.round(cssScale * 100)}%`;

      if (layout.truncated && !this.warnedTruncation) {
        this.warnedTruncation = true;
        toast('Preview capped at 40 pages. Split very long texts into separate projects.', 'info', 6000);
      }
    } catch (err) {
      toast(`Preview failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      this.busy = false;
      if (this.pending) {
        this.pending = false;
        this.schedule();
      }
    }
  }
}

export const preview = new PreviewController();
