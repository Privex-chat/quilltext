import {
  ProjectMeta,
  PageMeta,
  listProjects,
  listPages,
  createProject,
  createPage,
  openProject,
  openPage,
  renameProject,
  renamePage,
  deleteProject,
  deletePage,
  duplicatePage,
  setCurrentPageAsProjectDefaults,
  resetCurrentPageToProjectDefaults,
  currentProject,
  currentPage
} from '../state/projects';
import { store } from '../state/store';
import { attachMenu, confirmDialog, promptDialog, toast } from './chrome';

let projectMenuCtl: { close: () => void };
let pageMenuCtl: { close: () => void };

export function initProjectMenu(): void {
  const projectBtn = document.getElementById('project-btn')!;
  const projectMenu = document.getElementById('project-menu')!;
  const pageBtn = document.getElementById('page-btn')!;
  const pageMenu = document.getElementById('page-menu')!;
  const projectName = document.getElementById('project-name')!;
  const pageName = document.getElementById('page-name')!;

  projectMenuCtl = attachMenu(projectBtn, projectMenu, () => renderProjectMenu(projectMenu));
  pageMenuCtl = attachMenu(pageBtn, pageMenu, () => renderPageMenu(pageMenu));

  const sync = () => {
    projectName.textContent = currentProject()?.name ?? 'Project';
    pageName.textContent = currentPage()?.name ?? 'Page';
  };
  sync();
  store.subscribe((kind) => {
    if (kind === 'project') sync();
  });

  pageBtn.addEventListener('dblclick', (e) => {
    e.preventDefault();
    void renameCurrentPage();
  });
}

async function renameCurrentPage(): Promise<void> {
  const cur = currentPage();
  if (!cur) return;
  const name = await promptDialog('Rename page', cur.name);
  if (name && name !== cur.name) {
    renamePage(cur.id, name);
    toast('Renamed.', 'success');
  }
}

// ── project menu ─────────────────────────────────────────────────────────────

function renderProjectMenu(menu: HTMLElement): void {
  const cur = currentProject();
  menu.innerHTML = '';
  menu.appendChild(head('Projects'));

  const list = document.createElement('div');
  list.className = 'menu-list';
  for (const p of listProjects()) {
    list.appendChild(
      projectRow(p, p.id === cur?.id, {
        open: () => {
          if (p.id !== cur?.id) {
            openProject(p.id);
            toast(`Opened "${p.name}".`);
          }
          projectMenuCtl.close();
        },
        rename: async () => {
          const name = await promptDialog('Rename project', p.name);
          if (name) renameProject(p.id, name);
          renderProjectMenu(menu);
        },
        remove: async () => {
          if (listProjects().length === 1) {
            toast('This is your only project. Create another first.', 'info');
            return;
          }
          const pages = listPages(p.id).length;
          if (
            await confirmDialog(
              'Delete project?',
              `"${p.name}" and its ${pages} page${pages === 1 ? '' : 's'} will be permanently removed from this browser.`
            )
          ) {
            deleteProject(p.id);
            renderProjectMenu(menu);
          }
        }
      })
    );
  }
  menu.appendChild(list);

  menu.appendChild(
    newButton('+ New project', () => {
      createProject();
      projectMenuCtl.close();
      toast('Project created.', 'success');
    })
  );
}

// ── page menu ────────────────────────────────────────────────────────────────

function renderPageMenu(menu: HTMLElement): void {
  const proj = currentProject();
  const curPage = currentPage();
  menu.innerHTML = '';
  menu.appendChild(head(proj ? `Pages in ${proj.name}` : 'Pages'));

  const list = document.createElement('div');
  list.className = 'menu-list';
  for (const pg of proj ? listPages(proj.id) : []) {
    list.appendChild(
      pageRow(pg, pg.id === curPage?.id, {
        open: () => {
          if (pg.id !== curPage?.id) {
            openPage(pg.id);
            toast(`Opened "${pg.name}".`);
          }
          pageMenuCtl.close();
        },
        rename: async () => {
          const name = await promptDialog('Rename page', pg.name);
          if (name) renamePage(pg.id, name);
          renderPageMenu(menu);
        },
        duplicate: () => {
          const copy = duplicatePage(pg.id);
          if (copy) toast(`Duplicated "${pg.name}".`, 'success');
          renderPageMenu(menu);
        },
        remove: async () => {
          if (proj && listPages(proj.id).length === 1) {
            toast('A project needs at least one page.', 'info');
            return;
          }
          if (await confirmDialog('Delete page?', `"${pg.name}" will be permanently removed.`)) {
            deletePage(pg.id);
            renderPageMenu(menu);
          }
        }
      })
    );
  }
  menu.appendChild(list);

  menu.appendChild(
    newButton('+ New page', () => {
      if (proj) createPage(proj.id, `Page ${listPages(proj.id).length + 1}`);
      pageMenuCtl.close();
      toast('Page added.', 'success');
    })
  );

  menu.append(
    menuButton('Set project defaults from this page', () => {
      if (setCurrentPageAsProjectDefaults()) toast('Project defaults updated.', 'success');
      pageMenuCtl.close();
    }),
    menuButton('Reset this page to project defaults', () => {
      if (resetCurrentPageToProjectDefaults()) toast('Page style reset.', 'success');
      pageMenuCtl.close();
    })
  );
}

// ── row builders ─────────────────────────────────────────────────────────────

interface ProjectActions {
  open: () => void;
  rename: () => void;
  remove: () => void;
}
function projectRow(p: ProjectMeta, current: boolean, a: ProjectActions): HTMLElement {
  const pageCount = listPages(p.id).length;
  const row = rowShell(current);
  row.appendChild(
    openButton(p.name, `${pageCount} page${pageCount === 1 ? '' : 's'} · ${relTime(p.updatedAt)}`, a.open)
  );
  row.appendChild(actionCluster([iconRename(a.rename), iconDelete(a.remove)]));
  return row;
}

interface PageActions {
  open: () => void;
  rename: () => void;
  duplicate: () => void;
  remove: () => void;
}
function pageRow(p: PageMeta, current: boolean, a: PageActions): HTMLElement {
  const row = rowShell(current);
  row.appendChild(openButton(p.name, relTime(p.updatedAt), a.open));
  row.appendChild(actionCluster([iconRename(a.rename), iconDuplicate(a.duplicate), iconDelete(a.remove)]));
  return row;
}

function rowShell(current: boolean): HTMLElement {
  const row = document.createElement('div');
  row.className = 'menu-project' + (current ? ' is-current' : '');
  return row;
}
function openButton(name: string, sub: string, onClick: () => void): HTMLElement {
  const b = document.createElement('button');
  b.className = 'menu-project-open';
  b.setAttribute('role', 'menuitem');
  b.innerHTML = `<span class="mp-name"></span><span class="mp-date"></span>`;
  b.querySelector('.mp-name')!.textContent = name;
  b.querySelector('.mp-date')!.textContent = sub;
  b.addEventListener('click', onClick);
  return b;
}
function actionCluster(btns: HTMLElement[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'menu-project-actions';
  wrap.append(...btns);
  return wrap;
}

function head(text: string): HTMLElement {
  const h = document.createElement('div');
  h.className = 'menu-head';
  h.textContent = text;
  return h;
}
function newButton(label: string, onClick: () => void): HTMLElement {
  const b = document.createElement('button');
  b.className = 'menu-item menu-new';
  b.setAttribute('role', 'menuitem');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
function menuButton(label: string, onClick: () => void): HTMLElement {
  const b = document.createElement('button');
  b.className = 'menu-item';
  b.setAttribute('role', 'menuitem');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

const P_RENAME = 'M4 13.5V16h2.5l7-7L11 6.5l-7 7ZM15.7 7.3a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-1.2 1.2 3 3 1.2-1.2Z';
const P_DUP = 'M6 6V3h11v11h-3M3 6h11v11H3V6Z';
const P_DEL = 'M5 6h10M8 6V4h4v2M6 6l1 10h6l1-10';

function iconAction(label: string, path: string, onClick: () => void, danger = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'icon-action' + (danger ? ' is-danger' : '');
  b.title = label;
  b.setAttribute('aria-label', label);
  b.innerHTML = `<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}
const iconRename = (fn: () => void) => iconAction('Rename', P_RENAME, fn);
const iconDuplicate = (fn: () => void) => iconAction('Duplicate', P_DUP, fn);
const iconDelete = (fn: () => void) => iconAction('Delete', P_DEL, fn, true);

function relTime(ts: number): string {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
