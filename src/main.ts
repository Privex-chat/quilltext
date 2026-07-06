import './styles.css';
import { store } from './state/store';
// Debug handle so tooling/tests can reach the real singletons (harmless).
(window as unknown as { __quilltext: unknown }).__quilltext = { store };
import { initProjects } from './state/projects';
import { initEditor } from './ui/editor';
import { initPanel } from './ui/panel';
import { preview } from './ui/preview';
import { initProjectMenu } from './ui/projectmenu';
import { openWizard } from './ui/wizard';
import { buildExportMenu, exportPdf } from './ui/exporter';
import { attachMenu, initMobileTabs, initTheme, progress } from './ui/chrome';
import { startTutorial, shouldShowTutorial } from './ui/tutorial';
import { openUserGuide, openTechnicalDocs } from './ui/guides';

function showWelcome(): void {
  const dlg = document.createElement('dialog');
  dlg.className = 'welcome';
  dlg.innerHTML = `
    <div class="welcome-mark">
      <svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 32c3-9 10-20 20-24l5 5C26 18 16 25 6 32Zm0 0c2.5-.5 5-1.5 7-3"/>
      </svg>
    </div>
    <h2 class="welcome-title">Welcome to Quilltext</h2>
    <p class="welcome-body">
      Turn typed text into convincing handwritten pages. Choose your font, style the paper, add realistic imperfections, and export as PNG, JPEG, or PDF.
    </p>
    <p class="welcome-hint">Everything runs in your browser - your text never leaves your machine.</p>
    <div class="welcome-actions">
      <button class="btn btn-primary" id="welcome-tour">Take a Tour</button>
      <button class="btn btn-ghost" id="welcome-dismiss">Start writing</button>
    </div>
  `;
  document.body.appendChild(dlg);
  dlg.showModal();
  dlg.querySelector('#welcome-tour')!.addEventListener('click', () => {
    dlg.close();
    setTimeout(() => startTutorial(true), 300);
  });
  dlg.querySelector('#welcome-dismiss')!.addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => {
    dlg.remove();
    const btn = document.getElementById('help-btn');
    if (btn) btn.classList.remove('is-new');
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}

async function boot(): Promise<void> {
  progress.init();

  // Load any saved handwriting atlas before the first render.
  await store.init();

  // Restore the last project (or create one). This sets doc + settings, which
  // the editor and panel read on init.
  const saveState = document.getElementById('save-state')!;
  initProjects((state) => {
    saveState.textContent = state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved (storage full)' : 'Saved';
    saveState.classList.toggle('is-error', state === 'error');
  });

  initEditor();
  initPanel(openWizard);
  initProjectMenu();
  preview.init();

  initTheme(document.getElementById('theme-btn')!);
  initMobileTabs();

  const exportBtn = document.getElementById('export-btn')!;
  const exportMenu = document.getElementById('export-menu')!;
  buildExportMenu(exportMenu);
  attachMenu(exportBtn, exportMenu);

  // Help menu - tour, user guide, technical docs
  const helpBtn = document.getElementById('help-btn')!;
  const helpMenu = document.getElementById('help-menu')!;
  attachMenu(helpBtn, helpMenu);
  helpMenu.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement)?.dataset?.help;
    if (act === 'tour') startTutorial(true);
    else if (act === 'guide') openUserGuide();
    else if (act === 'tech') openTechnicalDocs();
  });

  // Welcome dialog on first visit.
  if (shouldShowTutorial()) {
    helpBtn.classList.add('is-new');
    setTimeout(showWelcome, 600);
  }

  // Keyboard: Ctrl/Cmd+S exports a PDF instead of the browser save dialog.
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void exportPdf();
    }
  });
}

boot();
