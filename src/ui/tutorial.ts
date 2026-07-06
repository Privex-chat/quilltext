/**
 * Interactive on-boarding tutorial — guided tour with spotlight + tooltip.
 * Highlights UI elements one at a time with explanatory text.
 * Fully responsive — works on desktop, tablet, and mobile viewports.
 */

const STORAGE_KEY = 'quilltext.tutorial.done';

interface Step {
  target: string;
  title: string;
  body: string;
  /** Preferred tooltip direction relative to target. Falls back if it overflows. */
  placement: 'top' | 'bottom' | 'left' | 'right';
  /** Switch mobile tab before targeting? */
  pane?: 'pane-write' | 'pane-preview' | 'pane-style';
  beforeHighlight?: () => void;
}

const STEPS: Step[] = [
  {
    target: '#editor',
    title: 'Start typing here',
    body: 'Type or paste any text into this panel. Every keystroke updates the handwriting preview instantly, in real time.',
    placement: 'right',
    pane: 'pane-write',
  },
  {
    target: '#ink-bar',
    title: 'Colored ink for emphasis',
    body: 'Select text in the editor, then pick a color swatch. The handwritten output will use that color for the selected words.',
    placement: 'bottom',
    pane: 'pane-write',
  },
  {
    target: '#pane-preview',
    title: 'Live preview',
    body: 'See your text rendered as handwritten pages on ruled paper. Scroll down for multi-page documents. Preview matches export pixel-for-pixel.',
    placement: 'left',
    pane: 'pane-preview',
  },
  {
    target: '.zoom-bar',
    title: 'Zoom controls',
    body: 'Zoom in for a close look at the handwriting detail or zoom out to see the full page layout. "Fit" fills the available space.',
    placement: 'top',
    pane: 'pane-preview',
  },
  {
    target: '#pane-style',
    title: 'Style toolbox',
    body: 'This panel controls every aspect of the page: font, paper, margins, realism effects, finishes, and extras. Open each section to explore.',
    placement: 'left',
    pane: 'pane-style',
  },
  {
    target: '[data-section="handwriting"]',
    title: 'Handwriting settings',
    body: 'Choose from 8 built-in handwriting fonts, upload your own .ttf, or scan your actual handwriting with the wizard. Adjust size, ink color, and spacing.',
    placement: 'left',
    pane: 'pane-style',
    beforeHighlight: () => scrollToSection(0),
  },
  {
    target: '[data-section="realism"]',
    title: 'Realism controls',
    body: 'Toggle handwriting variation, baseline wobble, ink flow changes, paper grain texture, and crossed-out mistakes. These make it look genuinely handwritten.',
    placement: 'left',
    pane: 'pane-style',
    beforeHighlight: () => scrollToSection(3),
  },
  {
    target: '[data-section="finish"]',
    title: 'Finish effects',
    body: 'Apply a shadow, scanner contrast, a smartphone-photo look, or place the page on a desk. Each effect transforms the page into a realistic image.',
    placement: 'left',
    pane: 'pane-style',
    beforeHighlight: () => scrollToSection(4),
  },
  {
    target: '#export-btn',
    title: 'Export your pages',
    body: 'Download as PNG, JPEG, or PDF. With the phone finish, JPEG exports include real EXIF camera metadata for an authentic photographed look.',
    placement: 'bottom',
  },
  {
    target: '#help-btn',
    title: 'All set!',
    body: 'Explore the Help menu for the full User Guide or deep-dive into the Technical Docs to understand the math and logic behind the rendering.',
    placement: 'bottom',
  },
];

function scrollToSection(sectionIdx: number): void {
  const panel = document.getElementById('pane-style');
  if (!panel) return;
  const details = panel.querySelectorAll<HTMLDetailsElement>('.ctl-group');
  const target = details[sectionIdx];
  if (target) {
    details.forEach((d) => (d.open = true));
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function activatePane(paneId: string): void {
  const app = document.querySelector('.app');
  if (!app) return;
  const current = app.getAttribute('data-mobile-pane');
  if (current === paneId) return;
  app.setAttribute('data-mobile-pane', paneId);
  // Sync mobile tab active state.
  document.querySelectorAll<HTMLButtonElement>('.mtab').forEach((tab) => {
    const isActive = tab.dataset.pane === paneId;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-pressed', String(isActive));
  });
}

let overlayEl: HTMLElement | null = null;
let spotlightEl: HTMLElement | null = null;
let tipEl: HTMLElement | null = null;
let currentStep = 0;

export function shouldShowTutorial(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}

export function startTutorial(reset = false): void {
  if (reset) localStorage.removeItem(STORAGE_KEY);
  currentStep = 0;
  runTutorial();
}

export function resetTutorial(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function runTutorial(): void {
  cleanupTutorial();
  overlayEl = document.createElement('div');
  overlayEl.className = 'tut-overlay';
  spotlightEl = document.createElement('div');
  spotlightEl.className = 'tut-spotlight';
  tipEl = document.createElement('div');
  tipEl.className = 'tut-tip';
  overlayEl.append(spotlightEl, tipEl);
  document.body.appendChild(overlayEl);
  showStep(currentStep);
}

function showStep(index: number): void {
  if (index < 0 || index >= STEPS.length) {
    cleanupTutorial();
    return;
  }
  currentStep = index;
  const step = STEPS[index];

  // Switch mobile pane before measuring layout.
  if (step.pane) activatePane(step.pane);
  if (step.beforeHighlight) step.beforeHighlight();

  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>(step.target);
    if (!target) {
      cleanupTutorial();
      return;
    }

    const rect = target.getBoundingClientRect();
    const gap = 14;
    const isMobile = window.innerWidth <= 860;
    const tipW = isMobile ? Math.min(300, window.innerWidth - 24) : 320;

    // ── spotlight ──────────────────────────────────────────────
    spotlightEl!.style.width = `${rect.width + 12}px`;
    spotlightEl!.style.height = `${rect.height + 12}px`;
    spotlightEl!.style.left = `${rect.left - 6}px`;
    spotlightEl!.style.top = `${rect.top - 6}px`;
    spotlightEl!.style.borderRadius = '8px';
    spotlightEl!.style.opacity = '1';

    // ── tooltip content (set first so offsetHeight is accurate) ──
    const total = STEPS.length;
    const isFirst = index === 0;
    const isLast = index === total - 1;

    tipEl!.innerHTML = `
      <div class="tut-tip-head">
        <span class="tut-step">${index + 1} / ${total}</span>
        <button class="tut-skip" aria-label="Skip tutorial">Skip</button>
      </div>
      <h3 class="tut-title">${step.title}</h3>
      <p class="tut-body">${step.body}</p>
      <div class="tut-dots">${STEPS.map((_, i) => `<span class="tut-dot${i === index ? ' is-active' : ''}"></span>`).join('')}</div>
      <div class="tut-actions">
        ${!isFirst ? '<button class="tut-prev btn btn-ghost">Back</button>' : '<span></span>'}
        ${!isLast
          ? '<button class="tut-next btn btn-primary">Next</button>'
          : '<button class="tut-next btn btn-primary">Done</button>'
        }
      </div>
    `;

    tipEl!.querySelector('.tut-skip')!.addEventListener('click', () => cleanupTutorial());
    tipEl!.querySelector('.tut-next')!.addEventListener('click', () => showStep(index + 1));
    const prev = tipEl!.querySelector('.tut-prev');
    if (prev) prev.addEventListener('click', () => showStep(index - 1));

    // ── adaptive positioning ────────────────────────────────────
    tipEl!.style.width = `${tipW}px`;
    tipEl!.style.left = '0';
    tipEl!.style.top = '0';

    // Force layout so offsetHeight is accurate.
    const tipH = tipEl!.offsetHeight;

    const place = (dir: string): { left: number; top: number } => {
      switch (dir) {
        case 'right':
          return { left: rect.right + gap, top: rect.top + rect.height / 2 - tipH / 2 };
        case 'left':
          return { left: rect.left - gap - tipW, top: rect.top + rect.height / 2 - tipH / 2 };
        case 'bottom':
          return { left: rect.left + rect.width / 2 - tipW / 2, top: rect.bottom + gap };
        case 'top':
          return { left: rect.left + rect.width / 2 - tipW / 2, top: rect.top - gap - tipH };
        default:
          return { left: 0, top: 0 };
      }
    };

    const fits = (pos: { left: number; top: number }): boolean =>
      pos.left >= 6 && pos.left + tipW <= window.innerWidth - 6 &&
      pos.top >= 6 && pos.top + tipH <= window.innerHeight - 6;

    // Try preferred placement, then fallbacks.
    const fallbacks: string[] = [step.placement];
    if (step.placement === 'left' || step.placement === 'right') {
      fallbacks.push('bottom', 'top');
    } else {
      fallbacks.push('left', 'right');
    }
    fallbacks.push('bottom', 'top', 'left', 'right');

    let pos = place(fallbacks[0]);
    for (const dir of fallbacks) {
      const candidate = place(dir);
      if (fits(candidate)) {
        pos = candidate;
        break;
      }
    }

    // Final safety clamp.
    pos.left = Math.max(6, Math.min(window.innerWidth - tipW - 6, pos.left));
    pos.top = Math.max(6, Math.min(window.innerHeight - tipH - 6, pos.top));

    tipEl!.style.left = `${pos.left}px`;
    tipEl!.style.top = `${pos.top}px`;
  });
}

function cleanupTutorial(): void {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
    localStorage.setItem(STORAGE_KEY, 'done');
  }
  spotlightEl = null;
  tipEl = null;
}
