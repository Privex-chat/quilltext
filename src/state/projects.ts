import { Doc, Run, Settings, defaultSettings } from '../engine/types';
import { store } from './store';

/**
 * Project model v2:
 *   Project = isolated assignment/workspace with shared settings, assets,
 *             history, and export metadata.
 *   Page    = text plus only the settings that differ from the project defaults.
 *
 * Older page records stored full settings per page. They are migrated lazily
 * into shared project settings + per-page overrides the first time they are read.
 */

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface PageMeta {
  id: string;
  projectId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectAssetRef {
  id: string;
  kind: 'font' | 'watermark' | 'handwriting-atlas' | 'signature' | 'cover-template';
  name: string;
  createdAt: number;
  mime?: string;
  size?: number;
  storageKey?: string;
}

export interface ProjectAssets {
  fonts: ProjectAssetRef[];
  watermarks: ProjectAssetRef[];
  handwritingAtlases: ProjectAssetRef[];
  signatures: ProjectAssetRef[];
  coverTemplates: ProjectAssetRef[];
}

export interface ProjectHistoryEntry {
  id: string;
  at: number;
  kind:
    | 'project-created'
    | 'project-migrated'
    | 'project-renamed'
    | 'project-defaults-updated'
    | 'page-created'
    | 'page-renamed'
    | 'page-deleted'
    | 'page-duplicated'
    | 'page-reset'
    | 'exported';
  label: string;
  pageId?: string;
}

export type ExportFormat = 'png' | 'jpeg' | 'pdf' | 'clipboard';

export interface ProjectExportMetadata {
  lastExportedAt: number | null;
  lastFormat: ExportFormat | null;
  lastPageCount: number;
  lastBundleId: string | null;
  finish: Settings['finish'];
  phoneProfileId: string | null;
}

export interface ProjectData {
  version: 2;
  sharedSettings: Settings;
  assets: ProjectAssets;
  history: ProjectHistoryEntry[];
  exportMetadata: ProjectExportMetadata;
  updatedAt: number;
}

interface PageDataV2 {
  version: 2;
  settingsOverrides: Partial<Settings>;
  paragraphs: Run[][];
  assetIds: string[];
  updatedAt: number;
}

interface LegacyPageData {
  settings?: Partial<Settings>;
  paragraphs?: Run[][];
}

interface LegacyProjectData {
  settings?: Partial<Settings>;
  paragraphs?: Run[][];
}

const PROJECTS_KEY = 'quilltext.projects';
const PAGES_KEY = 'quilltext.pages';
const CURRENT_KEY = 'quilltext.current';
const projectKey = (id: string) => `quilltext.project.${id}`;
const pageKey = (id: string) => `quilltext.page.${id}`;

const HISTORY_LIMIT = 80;
const SETTING_KEYS = Object.keys(defaultSettings()) as (keyof Settings)[];

let currentProjectId: string | null = null;
let currentPageId: string | null = null;
let saveTimer: number | undefined;
let onSaved: ((state: 'saving' | 'saved' | 'error') => void) | null = null;

// reads

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readRaw<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function listProjects(): ProjectMeta[] {
  const now = Date.now();
  return read<Partial<ProjectMeta>[]>(PROJECTS_KEY, [])
    .filter((p) => typeof p.id === 'string' && p.id.length > 0)
    .map((p) => ({
      id: p.id!,
      name: p.name || 'New project',
      createdAt: p.createdAt ?? p.updatedAt ?? now,
      updatedAt: p.updatedAt ?? p.createdAt ?? now
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function allPages(): PageMeta[] {
  const now = Date.now();
  return read<Partial<PageMeta>[]>(PAGES_KEY, [])
    .filter(
      (p) =>
        typeof p.id === 'string' &&
        p.id.length > 0 &&
        typeof p.projectId === 'string' &&
        p.projectId.length > 0
    )
    .map((p) => ({
      id: p.id!,
      projectId: p.projectId!,
      name: p.name || 'Untitled page',
      createdAt: p.createdAt ?? p.updatedAt ?? now,
      updatedAt: p.updatedAt ?? p.createdAt ?? now
    }));
}

export function listPages(projectId: string): PageMeta[] {
  return allPages()
    .filter((p) => p.projectId === projectId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function currentProject(): ProjectMeta | null {
  return listProjects().find((p) => p.id === currentProjectId) ?? null;
}

export function currentPage(): PageMeta | null {
  return allPages().find((p) => p.id === currentPageId) ?? null;
}

export function currentProjectData(): ProjectData | null {
  return currentProjectId ? readProjectData(currentProjectId) : null;
}

// writes

const writeProjects = (list: ProjectMeta[]) => localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
const writePages = (list: PageMeta[]) => localStorage.setItem(PAGES_KEY, JSON.stringify(list));
const writeProjectData = (id: string, data: ProjectData) =>
  localStorage.setItem(projectKey(id), JSON.stringify(data));
const writePageData = (id: string, data: PageDataV2) =>
  localStorage.setItem(pageKey(id), JSON.stringify(data));

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function touchProject(id: string, at = Date.now()): void {
  writeProjects(listProjects().map((p) => (p.id === id ? { ...p, updatedAt: at } : p)));
  const data = readProjectData(id);
  data.updatedAt = at;
  writeProjectData(id, data);
}

// schema helpers

function emptyAssets(): ProjectAssets {
  return {
    fonts: [],
    watermarks: [],
    handwritingAtlases: [],
    signatures: [],
    coverTemplates: []
  };
}

function defaultExportMetadata(): ProjectExportMetadata {
  return {
    lastExportedAt: null,
    lastFormat: null,
    lastPageCount: 0,
    lastBundleId: null,
    finish: 'none',
    phoneProfileId: null
  };
}

function cloneSettings(s: Settings): Settings {
  return JSON.parse(JSON.stringify(s)) as Settings;
}

function normalizeSettings(s?: Partial<Settings>): Settings {
  return { ...defaultSettings(), ...(s ?? {}) } as Settings;
}

function settingsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffSettings(base: Settings, effective: Settings): Partial<Settings> {
  const out: Partial<Settings> = {};
  for (const key of SETTING_KEYS) {
    if (!settingsEqual(base[key], effective[key])) {
      (out as Record<string, unknown>)[key] = effective[key];
    }
  }
  return out;
}

function mergeSettings(base: Settings, overrides: Partial<Settings>): Settings {
  const merged = cloneSettings(base);
  for (const key of SETTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      (merged as unknown as Record<string, unknown>)[key] = overrides[key];
    }
  }
  return merged;
}

function appendHistory(
  data: ProjectData,
  kind: ProjectHistoryEntry['kind'],
  label: string,
  pageId?: string,
  at = Date.now()
): void {
  data.history = [
    { id: newId(), at, kind, label, pageId },
    ...(data.history ?? [])
  ].slice(0, HISTORY_LIMIT);
}

function createProjectData(sharedSettings: Settings, at = Date.now()): ProjectData {
  return {
    version: 2,
    sharedSettings: cloneSettings(sharedSettings),
    assets: emptyAssets(),
    history: [],
    exportMetadata: defaultExportMetadata(),
    updatedAt: at
  };
}

function normalizeProjectData(
  raw: Partial<ProjectData> | LegacyProjectData | null,
  fallback: Settings,
  projectId: string
): ProjectData {
  if (!raw || !('version' in raw) || raw.version !== 2) {
    return migrateProjectData(projectId, fallback, raw as LegacyProjectData | null);
  }
  return {
    version: 2,
    sharedSettings: normalizeSettings(raw.sharedSettings),
    assets: { ...emptyAssets(), ...(raw.assets ?? {}) },
    history: (raw.history ?? []).slice(0, HISTORY_LIMIT),
    exportMetadata: { ...defaultExportMetadata(), ...(raw.exportMetadata ?? {}) },
    updatedAt: raw.updatedAt ?? Date.now()
  };
}

function readProjectData(projectId: string, fallback = store.settings): ProjectData {
  return normalizeProjectData(readRaw<Partial<ProjectData> | LegacyProjectData>(projectKey(projectId)), fallback, projectId);
}

function migrateProjectData(projectId: string, fallback: Settings, legacyProject: LegacyProjectData | null): ProjectData {
  const pages = listPages(projectId);
  const pageRaw = pages.length ? readRaw<LegacyPageData>(pageKey(pages[0].id)) : null;
  const shared = normalizeSettings(pageRaw?.settings ?? legacyProject?.settings ?? fallback);
  const data = createProjectData(shared);
  appendHistory(data, 'project-migrated', 'Upgraded project storage to shared settings and page overrides.');
  writeProjectData(projectId, data);

  if (!pages.length && legacyProject?.paragraphs) {
    const now = Date.now();
    const page: PageMeta = { id: newId(), projectId, name: 'Page 1', createdAt: now, updatedAt: now };
    writePages([page, ...allPages()]);
    writePageData(page.id, {
      version: 2,
      settingsOverrides: {},
      paragraphs: legacyProject.paragraphs.length ? legacyProject.paragraphs : [[]],
      assetIds: [],
      updatedAt: now
    });
    appendHistory(data, 'page-created', 'Created Page 1 from legacy project contents.', page.id, now);
    writeProjectData(projectId, data);
  }

  for (const page of pages) readPageData(page.id, data);
  return data;
}

function normalizePageData(raw: PageDataV2 | LegacyPageData | null, projectData: ProjectData): PageDataV2 | null {
  if (!raw) return null;
  if ('version' in raw && raw.version === 2) {
    return {
      version: 2,
      settingsOverrides: raw.settingsOverrides ?? {},
      paragraphs: raw.paragraphs?.length ? raw.paragraphs : [[]],
      assetIds: raw.assetIds ?? [],
      updatedAt: raw.updatedAt ?? Date.now()
    };
  }
  const legacy = raw as LegacyPageData;
  const effective = normalizeSettings(legacy.settings);
  return {
    version: 2,
    settingsOverrides: diffSettings(projectData.sharedSettings, effective),
    paragraphs: legacy.paragraphs?.length ? legacy.paragraphs : [[]],
    assetIds: [],
    updatedAt: Date.now()
  };
}

function readPageData(id: string, projectData: ProjectData): PageDataV2 | null {
  const raw = readRaw<PageDataV2 | LegacyPageData>(pageKey(id));
  const data = normalizePageData(raw, projectData);
  if (data && (!raw || !('version' in raw) || raw.version !== 2)) writePageData(id, data);
  return data;
}

// project ops

export function createProject(name = 'New project'): ProjectMeta {
  const now = Date.now();
  const meta: ProjectMeta = { id: newId(), name, createdAt: now, updatedAt: now };
  const data = createProjectData(store.settings, now);
  appendHistory(data, 'project-created', `Created project "${name}".`, undefined, now);
  writeProjectData(meta.id, data);
  writeProjects([meta, ...listProjects()]);
  currentProjectId = meta.id;
  const page = createPage(meta.id, 'Page 1', false);
  openPage(page.id);
  store.emit('project');
  return meta;
}

export function renameProject(id: string, name: string): void {
  const now = Date.now();
  writeProjects(listProjects().map((p) => (p.id === id ? { ...p, name, updatedAt: now } : p)));
  const data = readProjectData(id);
  appendHistory(data, 'project-renamed', `Renamed project to "${name}".`, undefined, now);
  data.updatedAt = now;
  writeProjectData(id, data);
  store.emit('project');
}

export function deleteProject(id: string): void {
  for (const page of listPages(id)) localStorage.removeItem(pageKey(page.id));
  localStorage.removeItem(projectKey(id));
  writePages(allPages().filter((p) => p.projectId !== id));
  writeProjects(listProjects().filter((p) => p.id !== id));
  if (currentProjectId === id) {
    const rest = listProjects();
    if (rest.length) openProject(rest[0].id);
    else createProject();
  }
  store.emit('project');
}

/** Open a project by activating its most recent page (or a fresh one). */
export function openProject(id: string): void {
  currentProjectId = id;
  readProjectData(id);
  const pages = listPages(id);
  if (pages.length) openPage(pages[0].id);
  else openPage(createPage(id, 'Page 1', false).id);
  store.emit('project');
}

export function setCurrentPageAsProjectDefaults(): boolean {
  if (!currentProjectId || !currentPageId) return false;
  const now = Date.now();
  const projectData = readProjectData(currentProjectId);
  projectData.sharedSettings = cloneSettings(store.settings);
  projectData.updatedAt = now;
  appendHistory(projectData, 'project-defaults-updated', 'Updated project defaults from the current page.', currentPageId, now);
  writeProjectData(currentProjectId, projectData);
  const pageData: PageDataV2 = {
    version: 2,
    settingsOverrides: {},
    paragraphs: store.doc.paragraphs,
    assetIds: [],
    updatedAt: now
  };
  writePageData(currentPageId, pageData);
  touchProject(currentProjectId, now);
  store.emit('project');
  return true;
}

// page ops

export function createPage(projectId: string, name = 'Untitled page', open = true): PageMeta {
  const now = Date.now();
  const meta: PageMeta = { id: newId(), projectId, name, createdAt: now, updatedAt: now };
  const data: PageDataV2 = { version: 2, settingsOverrides: {}, paragraphs: [[]], assetIds: [], updatedAt: now };
  writePages([meta, ...allPages()]);
  writePageData(meta.id, data);
  const projectData = readProjectData(projectId);
  appendHistory(projectData, 'page-created', `Created page "${name}".`, meta.id, now);
  projectData.updatedAt = now;
  writeProjectData(projectId, projectData);
  touchProject(projectId, now);
  if (open) {
    openPage(meta.id);
    store.emit('project');
  }
  return meta;
}

export function openPage(id: string): boolean {
  const meta = allPages().find((p) => p.id === id);
  if (!meta) return false;
  const projectData = readProjectData(meta.projectId);
  const data = readPageData(id, projectData);
  if (!data) return false;
  currentPageId = id;
  currentProjectId = meta.projectId;
  localStorage.setItem(CURRENT_KEY, JSON.stringify({ projectId: currentProjectId, pageId: id }));
  store.replaceSettings(mergeSettings(projectData.sharedSettings, data.settingsOverrides));
  const doc: Doc = { paragraphs: data.paragraphs?.length ? data.paragraphs : [[]] };
  store.setDoc(doc);
  store.emit('project');
  return true;
}

export function renamePage(id: string, name: string): void {
  const now = Date.now();
  const meta = allPages().find((p) => p.id === id);
  writePages(allPages().map((p) => (p.id === id ? { ...p, name, updatedAt: now } : p)));
  if (meta) {
    const data = readProjectData(meta.projectId);
    appendHistory(data, 'page-renamed', `Renamed page to "${name}".`, id, now);
    data.updatedAt = now;
    writeProjectData(meta.projectId, data);
    touchProject(meta.projectId, now);
  }
  store.emit('project');
}

export function deletePage(id: string): void {
  const meta = allPages().find((p) => p.id === id);
  if (!meta) return;
  const siblings = listPages(meta.projectId).filter((p) => p.id !== id);
  const now = Date.now();
  const data = readProjectData(meta.projectId);
  appendHistory(data, 'page-deleted', `Deleted page "${meta.name}".`, id, now);
  data.updatedAt = now;
  writeProjectData(meta.projectId, data);
  localStorage.removeItem(pageKey(id));
  writePages(allPages().filter((p) => p.id !== id));
  touchProject(meta.projectId, now);
  if (currentPageId === id) {
    if (siblings.length) openPage(siblings[0].id);
    else openPage(createPage(meta.projectId, 'Page 1', false).id);
  }
  store.emit('project');
}

export function duplicatePage(id: string): PageMeta | null {
  const meta = allPages().find((p) => p.id === id);
  if (!meta) return null;
  const projectData = readProjectData(meta.projectId);
  const src = readPageData(id, projectData);
  if (!src) return null;
  const now = Date.now();
  const copy: PageMeta = { id: newId(), projectId: meta.projectId, name: `${meta.name} copy`, createdAt: now, updatedAt: now };
  writePageData(copy.id, { ...src, updatedAt: now });
  writePages([copy, ...allPages()]);
  appendHistory(projectData, 'page-duplicated', `Duplicated "${meta.name}".`, copy.id, now);
  projectData.updatedAt = now;
  writeProjectData(meta.projectId, projectData);
  touchProject(meta.projectId, now);
  store.emit('project');
  return copy;
}

export function resetCurrentPageToProjectDefaults(): boolean {
  if (!currentProjectId || !currentPageId) return false;
  const now = Date.now();
  const projectData = readProjectData(currentProjectId);
  const pageData: PageDataV2 = {
    version: 2,
    settingsOverrides: {},
    paragraphs: store.doc.paragraphs,
    assetIds: [],
    updatedAt: now
  };
  writePageData(currentPageId, pageData);
  appendHistory(projectData, 'page-reset', 'Reset page style to project defaults.', currentPageId, now);
  projectData.updatedAt = now;
  writeProjectData(currentProjectId, projectData);
  touchProject(currentProjectId, now);
  store.replaceSettings(projectData.sharedSettings);
  store.emit('project');
  return true;
}

// export metadata

export function recordProjectExport(format: ExportFormat, pageCount: number): void {
  if (!currentProjectId) return;
  const now = Date.now();
  const data = readProjectData(currentProjectId);
  data.exportMetadata = {
    lastExportedAt: now,
    lastFormat: format,
    lastPageCount: pageCount,
    lastBundleId: `${currentProjectId}-${now.toString(36)}`,
    finish: store.settings.finish,
    phoneProfileId: store.settings.finish === 'phone' ? store.settings.phoneProfileId : null
  };
  appendHistory(data, 'exported', `Exported ${pageCount} page${pageCount === 1 ? '' : 's'} as ${format.toUpperCase()}.`, currentPageId ?? undefined, now);
  data.updatedAt = now;
  writeProjectData(currentProjectId, data);
  touchProject(currentProjectId, now);
}

// autosave

function saveNow(): void {
  if (!currentPageId) return;
  const meta = allPages().find((p) => p.id === currentPageId);
  if (!meta) return;
  const now = Date.now();
  const projectData = readProjectData(meta.projectId);
  const data: PageDataV2 = {
    version: 2,
    settingsOverrides: diffSettings(projectData.sharedSettings, store.settings),
    paragraphs: store.doc.paragraphs,
    assetIds: [],
    updatedAt: now
  };
  try {
    writePageData(currentPageId, data);
    writePages(allPages().map((p) => (p.id === currentPageId ? { ...p, updatedAt: now } : p)));
    projectData.updatedAt = now;
    writeProjectData(meta.projectId, projectData);
    touchProject(meta.projectId, now);
    onSaved?.('saved');
  } catch {
    onSaved?.('error');
  }
}

export function initProjects(onState: (state: 'saving' | 'saved' | 'error') => void): void {
  onSaved = onState;

  const cur = read<{ projectId: string; pageId: string } | null>(CURRENT_KEY, null);
  if (cur && openPage(cur.pageId)) {
    /* restored last session */
  } else {
    const projects = listProjects();
    if (projects.length) openProject(projects[0].id);
    else createProject();
  }

  store.subscribe((kind) => {
    if (kind !== 'settings' && kind !== 'doc') return;
    onSaved?.('saving');
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, 600);
  });

  onSaved?.('saved');
}
