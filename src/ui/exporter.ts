import { renderPages } from '../render';
import { store } from '../state/store';
import { currentPage, recordProjectExport } from '../state/projects';
import { getPhoneProfile, injectExif } from '../engine/exif';
import { derive } from '../engine/rng';
import { progress, toast } from './chrome';

const PDF_SIZES: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792]
};

let exporting = false;

function slug(): string {
  const name = currentPage()?.name ?? 'quilltext';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'quilltext';
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Encoding failed.'))), type, quality)
  );

async function guarded(fn: () => Promise<void>): Promise<void> {
  if (exporting) {
    toast('An export is already running.', 'info');
    return;
  }
  exporting = true;
  document.getElementById('export-btn')!.setAttribute('disabled', '');
  try {
    await fn();
  } catch (err) {
    toast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error', 6000);
  } finally {
    exporting = false;
    document.getElementById('export-btn')!.removeAttribute('disabled');
    progress.hide();
  }
}

async function renderFull(): Promise<HTMLCanvasElement[]> {
  progress.show('Rendering pages…');
  const { canvases } = await renderPages(store.settings.exportScale, (done, total) =>
    progress.update((done / total) * 0.8, `Rendering page ${done} / ${total}`)
  );
  return canvases;
}

export function exportImages(kind: 'png' | 'jpeg'): Promise<void> {
  return guarded(async () => {
    const canvases = await renderFull();
    const ext = kind === 'png' ? 'png' : 'jpg';
    const mime = kind === 'png' ? 'image/png' : 'image/jpeg';
    // Phone finish + JPEG → stamp believable camera EXIF. One phone "took" all
    // pages, minutes apart, like a real photo burst.
    const stampExif = kind === 'jpeg' && store.settings.finish === 'phone' && store.settings.phoneMetadata;
    const profile = getPhoneProfile(store.settings.phoneProfileId);
    const timeRng = derive(store.settings.seed, 99);
    const baseTime = Date.now();
    const cadenceSec = 42 + Math.floor(timeRng() * 86);

    for (let i = 0; i < canvases.length; i++) {
      progress.update(0.8 + (0.2 * (i + 1)) / canvases.length, `Saving image ${i + 1} / ${canvases.length}`);
      let blob = await toBlob(canvases[i], mime, store.settings.jpegQuality);
      if (stampExif) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const when = new Date(baseTime + i * cadenceSec * 1000);
        const out = injectExif(bytes, profile, when);
        blob = new Blob([out.buffer as ArrayBuffer], { type: 'image/jpeg' });
      }
      downloadBlob(blob, canvases.length === 1 ? `${slug()}.${ext}` : `${slug()}-page-${i + 1}.${ext}`);
      if (i < canvases.length - 1) await new Promise((r) => setTimeout(r, 350));
    }
    recordProjectExport(kind, canvases.length);
    const suffix = stampExif ? ` (tagged ${profile.model})` : '';
    toast(`Saved ${canvases.length} ${ext.toUpperCase()} ${canvases.length === 1 ? 'file' : 'files'}${suffix}.`, 'success');
  });
}

export function exportPdf(): Promise<void> {
  return guarded(async () => {
    const canvases = await renderFull();
    progress.update(0.82, 'Building PDF…');
    const { jsPDF } = await import('jspdf');
    const [pw, ph] = PDF_SIZES[store.settings.pageSize];
    const doc = new jsPDF({ unit: 'pt', format: [pw, ph] });

    canvases.forEach((canvas, i) => {
      if (i > 0) doc.addPage([pw, ph]);
      // Finishes can pad the canvas: fit preserving aspect ratio, centered
      // (v1 stretched everything into a fixed box).
      const scale = Math.min(pw / canvas.width, ph / canvas.height);
      const w = canvas.width * scale;
      const h = canvas.height * scale;
      if (w < pw - 1 || h < ph - 1) {
        const px = canvas.getContext('2d')!.getImageData(2, 2, 1, 1).data;
        doc.setFillColor(px[0], px[1], px[2]);
        doc.rect(0, 0, pw, ph, 'F');
      }
      const data = canvas.toDataURL('image/jpeg', store.settings.jpegQuality);
      doc.addImage(data, 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h, `page-${i}`);
      progress.update(0.82 + (0.18 * (i + 1)) / canvases.length, `Adding page ${i + 1} / ${canvases.length}`);
    });

    doc.save(`${slug()}.pdf`);
    recordProjectExport('pdf', canvases.length);
    toast('PDF saved.', 'success');
  });
}

export function copyFirstPage(): Promise<void> {
  return guarded(async () => {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      toast('Clipboard images are not supported in this browser.', 'error');
      return;
    }
    const canvases = await renderFull();
    progress.update(0.9, 'Copying…');
    const blob = await toBlob(canvases[0], 'image/png');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    recordProjectExport('clipboard', 1);
    toast('First page copied to clipboard.', 'success');
  });
}

export function buildExportMenu(menu: HTMLElement): void {
  const items: [string, () => Promise<void>][] = [
    ['Download PNG', () => exportImages('png')],
    ['Download JPEG', () => exportImages('jpeg')],
    ['Download PDF', () => exportPdf()],
    ['Copy first page', () => copyFirstPage()]
  ];
  for (const [label, action] of items) {
    const b = document.createElement('button');
    b.className = 'menu-item';
    b.setAttribute('role', 'menuitem');
    b.textContent = label;
    b.addEventListener('click', () => {
      menu.hidden = true;
      void action();
    });
    menu.appendChild(b);
  }
}
