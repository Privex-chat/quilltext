/** Toasts, confirm dialog, dropdown menus, theme, mobile tabs, progress bar. */

export function toast(message: string, kind: 'info' | 'success' | 'error' = 'info', ms = 3800): void {
  const host = document.getElementById('toasts')!;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast-in'));
  setTimeout(() => {
    el.classList.remove('toast-in');
    setTimeout(() => el.remove(), 250);
  }, ms);
}

export function confirmDialog(title: string, body: string, actionLabel = 'Delete'): Promise<boolean> {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'confirm';
    dlg.innerHTML = `
      <h2></h2><p></p>
      <div class="confirm-actions">
        <button class="btn" data-act="cancel">Cancel</button>
        <button class="btn btn-danger" data-act="ok"></button>
      </div>`;
    dlg.querySelector('h2')!.textContent = title;
    dlg.querySelector('p')!.textContent = body;
    (dlg.querySelector('[data-act="ok"]') as HTMLElement).textContent = actionLabel;
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).dataset?.act;
      if (act) {
        dlg.close();
        resolve(act === 'ok');
      } else if (e.target === dlg) {
        dlg.close();
        resolve(false);
      }
    });
    dlg.addEventListener('cancel', () => resolve(false));
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
    (dlg.querySelector('[data-act="cancel"]') as HTMLElement).focus();
  });
}

/** Minimal inline text prompt (styled + focus-managed; no native prompt()). */
export function promptDialog(title: string, initial: string): Promise<string | null> {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'confirm';
    dlg.innerHTML = `
      <h2></h2>
      <input class="prompt-input" type="text" />
      <div class="confirm-actions">
        <button class="btn" data-act="cancel">Cancel</button>
        <button class="btn btn-primary" data-act="ok">Save</button>
      </div>`;
    dlg.querySelector('h2')!.textContent = title;
    const input = dlg.querySelector<HTMLInputElement>('.prompt-input')!;
    input.value = initial;
    const done = (val: string | null) => {
      dlg.close();
      resolve(val);
    };
    dlg.querySelector('[data-act="ok"]')!.addEventListener('click', () => done(input.value.trim() || null));
    dlg.querySelector('[data-act="cancel"]')!.addEventListener('click', () => done(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(input.value.trim() || null);
    });
    dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
    input.focus();
    input.select();
  });
}

/** Anchor button + menu element: toggling, click-away, Escape, aria-expanded. */
export function attachMenu(btn: HTMLElement, menu: HTMLElement, onOpen?: () => void): { close: () => void } {
  const close = () => {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    document.querySelectorAll('.menu-open-marker').forEach((m) => ((m as HTMLElement).hidden = true));
    if (open) {
      onOpen?.();
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    } else {
      close();
    }
  });
  menu.classList.add('menu-open-marker');
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target as Node)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      close();
      btn.focus();
    }
  });
  return { close };
}

export function initTheme(btn: HTMLElement): void {
  btn.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = cur;
    localStorage.setItem('quilltext.theme', cur);
  });
}

export function initMobileTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.mtab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-pressed', String(t === tab));
      });
      document.querySelector('.app')!.setAttribute('data-mobile-pane', tab.dataset.pane!);
    });
  });
  document.querySelector('.app')!.setAttribute('data-mobile-pane', 'pane-preview');
}

export const progress = {
  el: null as HTMLElement | null,
  bar: null as HTMLElement | null,
  label: null as HTMLElement | null,
  init(): void {
    this.el = document.getElementById('progress');
    this.bar = document.getElementById('progress-bar');
    this.label = document.getElementById('progress-label');
  },
  show(label: string): void {
    this.el!.hidden = false;
    this.update(0, label);
  },
  update(frac: number, label?: string): void {
    this.bar!.style.width = `${Math.round(frac * 100)}%`;
    if (label) this.label!.textContent = label;
  },
  hide(): void {
    this.el!.hidden = true;
    this.bar!.style.width = '0%';
  }
};
