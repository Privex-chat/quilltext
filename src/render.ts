import { layoutDocument, LayoutResult } from './engine/layout';
import { paintPage, paintCoverPage, RenderResources } from './engine/paint';
import { applyFinish } from './engine/effects';
import { FontScribe, Scribe } from './engine/scribe';
import { AtlasScribe } from './engine/atlas';
import { ATLAS_FAMILY, ensureFontLoaded, ptToPx } from './engine/fonts';
import { store } from './state/store';

export interface RenderedDoc {
  canvases: HTMLCanvasElement[];
  layout: LayoutResult;
}

function makeScribe(sizePx: number): Scribe {
  const s = store.settings;
  if (s.fontFamily === ATLAS_FAMILY && store.atlas) {
    return new AtlasScribe(store.atlas, sizePx, new FontScribe('Homemade Apple', sizePx));
  }
  const family = s.fontFamily === ATLAS_FAMILY ? 'Homemade Apple' : s.fontFamily;
  return new FontScribe(family, sizePx);
}

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * The ONE pipeline. Preview calls it with a screen-fit scale, export with the
 * output scale. Identical layout, painting, and finish code both times, so
 * "preview differs from output" is impossible by construction.
 */
export async function renderPages(
  scale: number,
  onPage?: (done: number, total: number) => void
): Promise<RenderedDoc> {
  const s = store.settings;
  const sizePx = ptToPx(s.fontSizePt);
  const family = s.fontFamily === ATLAS_FAMILY ? 'Homemade Apple' : s.fontFamily;
  await ensureFontLoaded(family, sizePx);

  const scribe = makeScribe(sizePx);
  const res: RenderResources = { logoImage: s.logo && s.logoMode === 'image' ? store.getImage(s.logoImageData) : null };
  const layout = layoutDocument(store.doc, s, scribe);
  const total = layout.pages.length + (s.coverPage ? 1 : 0);
  const canvases: HTMLCanvasElement[] = [];
  let done = 0;

  if (s.coverPage) {
    const c = document.createElement('canvas');
    paintCoverPage(c, layout.geom, s, scribe, scale, res);
    canvases.push(applyFinish(c, s, -1));
    onPage?.(++done, total);
    await nextTick();
  }

  for (let i = 0; i < layout.pages.length; i++) {
    const c = document.createElement('canvas');
    paintPage(c, layout.pages[i], i, layout.geom, s, scribe, scale, res);
    canvases.push(applyFinish(c, s, i));
    onPage?.(++done, total);
    if (i < layout.pages.length - 1) await nextTick(); // keep the UI breathing
  }

  return { canvases, layout };
}
