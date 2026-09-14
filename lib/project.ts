export type ProjectPoint = { x: number; y: number };
export type ProjectElementType = 'spot' | 'chandelier' | 'lightLine' | 'cornice';
export type ProjectElement = {
  id: number;
  type: ProjectElementType;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  price?: number;
};
export type ProjectPrices = {
  canvasPricePerM2: number;
  profilePricePerM: number;
  insertPricePerM: number;
  fastenerPricePerM: number;
  spotlightPrice: number;
  chandelierPrice: number;
  lightLinePricePerM: number;
  cornicePricePerM: number;
  wastePercent: number;
  laborPricePerM2: number;
};
export type ProjectClient = { name: string; phone: string; address: string };

export type ProjectVariant = {
  id: string;
  name: string;
  price: number;
  points?: ProjectPoint[];
  elements?: ProjectElement[];
  quantityOverrides?: Record<string, number>;
};

export type CeilingProject = {
  id: string;
  name: string;
  updatedAt: string;
  points: ProjectPoint[];
  elements: ProjectElement[];
  prices: ProjectPrices;
  client: ProjectClient;
  clientId?: string;
  notes: string;
  variants?: ProjectVariant[];
  activeVariantId?: string;
  quantityOverrides?: Record<string, number>;
  orthogonalMode?: boolean;
};

const STORAGE_KEY = 'potolok-planner-projects';
const DELETED_STORAGE_KEY = 'potolok-planner-deleted';
const CHANGE_EVENT = 'potolok:projects-changed';

export type DeletedProject = { id: string; deletedAt: string };

function isDeletedProject(value: unknown): value is DeletedProject {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<DeletedProject>;
  return typeof p.id === 'string' && typeof p.deletedAt === 'string' && !Number.isNaN(Date.parse(p.deletedAt));
}

function isProjectPoint(value: unknown): value is ProjectPoint {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<ProjectPoint>;
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

function isProjectElement(value: unknown): value is ProjectElement {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<ProjectElement>;
  return Number.isFinite(e.id)
    && ['spot', 'chandelier', 'lightLine', 'cornice'].includes(e.type ?? '')
    && Number.isFinite(e.x)
    && Number.isFinite(e.y)
    && (e.x2 === undefined || Number.isFinite(e.x2))
    && (e.y2 === undefined || Number.isFinite(e.y2))
    && (e.width === undefined || Number.isFinite(e.width))
    && (e.height === undefined || Number.isFinite(e.height))
    && (e.price === undefined || Number.isFinite(e.price));
}

function isQuantityOverrides(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).every((item) => Number.isFinite(item));
}

function isProjectVariant(value: unknown): value is ProjectVariant {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ProjectVariant>;
  return typeof v.id === 'string'
    && typeof v.name === 'string'
    && Number.isFinite(v.price)
    && (v.points === undefined || (Array.isArray(v.points) && v.points.length >= 3 && v.points.every(isProjectPoint)))
    && (v.elements === undefined || (Array.isArray(v.elements) && v.elements.every(isProjectElement)))
    && (v.quantityOverrides === undefined || isQuantityOverrides(v.quantityOverrides));
}

function notifyProjectsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function onProjectsChanged(handler: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

export function loadProjects(): CeilingProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCeilingProject);
  } catch {
    return [];
  }
}

export function saveProjects(projects: CeilingProject[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Storage can be unavailable or full; keep the current UI usable.
  }
  notifyProjectsChanged();
}

export function loadDeletedProjects(): DeletedProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DELETED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDeletedProject);
  } catch {
    return [];
  }
}

function saveDeletedProjects(items: DeletedProject[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage can be unavailable or full; keep the current UI usable.
  }
}

export function clearDeletedProject(id: string) {
  saveDeletedProjects(loadDeletedProjects().filter((item) => item.id !== id));
}

export function removeProjectLocally(id: string, projects = loadProjects()) {
  const next = projects.filter((project) => project.id !== id);
  saveProjects(next);
  const deleted = loadDeletedProjects().filter((item) => item.id !== id);
  deleted.push({ id, deletedAt: new Date().toISOString() });
  saveDeletedProjects(deleted);
  return next;
}

export function createProjectId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function upsertProject(project: CeilingProject, projects = loadProjects()) {
  const next = [project, ...projects.filter((item) => item.id !== project.id)];
  saveProjects(next);
  return next;
}

export function duplicateProject(project: CeilingProject): CeilingProject {
  return {
    ...project,
    id: createProjectId(),
    name: `${project.name} — копия`,
    updatedAt: new Date().toISOString(),
    points: project.points.map((point) => ({ ...point })),
    elements: project.elements.map((element) => ({ ...element })),
    prices: { ...project.prices },
    client: { ...project.client },
    clientId: project.clientId,
    notes: project.notes,
    variants: project.variants?.map((variant) => ({
      ...variant,
      points: variant.points?.map((point) => ({ ...point })),
      elements: variant.elements?.map((element) => ({ ...element })),
      quantityOverrides: variant.quantityOverrides ? { ...variant.quantityOverrides } : undefined,
    })),
    quantityOverrides: project.quantityOverrides ? { ...project.quantityOverrides } : undefined,
    orthogonalMode: project.orthogonalMode ?? false,
  };
}

export function exportProjectsJson(projects = loadProjects()) {
  return JSON.stringify(
    {
      format: 'potolok-planner',
      version: 7,
      exportedAt: new Date().toISOString(),
      projects,
    },
    null,
    2,
  );
}

export function isCeilingProject(value: unknown): value is CeilingProject {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<CeilingProject>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(p.updatedAt)) &&
    Array.isArray(p.points) &&
    p.points.length >= 3 &&
    p.points.every(isProjectPoint) &&
    Array.isArray(p.elements) &&
    p.elements.every(isProjectElement) &&
    (p.variants === undefined || (Array.isArray(p.variants) && p.variants.every(isProjectVariant))) &&
    (p.orthogonalMode === undefined || typeof p.orthogonalMode === 'boolean') &&
    (p.clientId === undefined || typeof p.clientId === 'string')
  );
}

function newerProject(a: CeilingProject, b: CeilingProject) {
  return Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;
}

export function importProjectsJson(raw: string, existing = loadProjects()) {
  let parsed: { format?: string; version?: number; projects?: unknown[] };
  try {
    parsed = JSON.parse(raw) as { format?: string; version?: number; projects?: unknown[] };
  } catch {
    throw new Error('Файл резервной копии повреждён или имеет неверный JSON');
  }

  if (parsed.format !== 'potolok-planner' || !Array.isArray(parsed.projects)) {
    throw new Error('Неверный файл резервной копии Potolok Planner');
  }

  const valid = parsed.projects.filter(isCeilingProject);
  if (!valid.length && parsed.projects.length) {
    throw new Error('В резервной копии нет корректных проектов');
  }

  const byId = new Map(existing.map((project) => [project.id, project]));
  for (const project of valid) {
    const current = byId.get(project.id);
    byId.set(project.id, current ? newerProject(current, project) : project);
  }

  const next = Array.from(byId.values()).sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
  saveProjects(next);
  return next;
}
