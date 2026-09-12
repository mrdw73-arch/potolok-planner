export type ProjectPoint = { x: number; y: number };
export type ProjectElementType = 'spot' | 'chandelier' | 'cornice';
export type ProjectElement = {
  id: number;
  type: ProjectElementType;
  x: number;
  y: number;
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
  cornicePricePerM: number;
  wastePercent: number;
  laborPricePerM2: number;
};
export type ProjectClient = { name: string; phone: string; address: string };
export type ProjectVariant = { id: string; name: string; price: number };
export type CeilingProject = {
  id: string;
  name: string;
  updatedAt: string;
  points: ProjectPoint[];
  elements: ProjectElement[];
  prices: ProjectPrices;
  client: ProjectClient;
  notes: string;
  variants?: ProjectVariant[];
  activeVariantId?: string;
  quantityOverrides?: Record<string, number>;
  orthogonalMode?: boolean;
};

const STORAGE_KEY = 'potolok-planner-projects';

export function loadProjects(): CeilingProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProject);
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
    notes: project.notes,
    variants: project.variants?.map((variant) => ({ ...variant })),
    quantityOverrides: project.quantityOverrides ? { ...project.quantityOverrides } : undefined,
    orthogonalMode: project.orthogonalMode ?? false,
  };
}

export function exportProjectsJson(projects = loadProjects()) {
  return JSON.stringify(
    {
      format: 'potolok-planner',
      version: 5,
      exportedAt: new Date().toISOString(),
      projects,
    },
    null,
    2,
  );
}

function isProject(value: unknown): value is CeilingProject {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<CeilingProject>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(p.updatedAt)) &&
    Array.isArray(p.points) &&
    p.points.length >= 3 &&
    p.points.every((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)) &&
    Array.isArray(p.elements) &&
    p.elements.every((element) =>
      Number.isFinite(element?.id) &&
      ['spot', 'chandelier', 'cornice'].includes(element?.type ?? '') &&
      Number.isFinite(element?.x) &&
      Number.isFinite(element?.y) &&
      (element?.width === undefined || Number.isFinite(element.width)) &&
      (element?.height === undefined || Number.isFinite(element.height)) &&
      (element?.price === undefined || Number.isFinite(element.price)),
    ) &&
    (p.orthogonalMode === undefined || typeof p.orthogonalMode === 'boolean')
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

  const valid = parsed.projects.filter(isProject);
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
