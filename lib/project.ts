export type ProjectPoint = { x: number; y: number };
export type ProjectElementType = 'spot' | 'chandelier' | 'cornice';
export type ProjectElement = { id: number; type: ProjectElementType; x: number; y: number };
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
export type CeilingProject = {
  id: string;
  name: string;
  updatedAt: string;
  points: ProjectPoint[];
  elements: ProjectElement[];
  prices: ProjectPrices;
  client: ProjectClient;
  notes: string;
};

const STORAGE_KEY = 'potolok-planner-projects';

export function loadProjects(): CeilingProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: CeilingProject[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function createProjectId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  };
}

export function exportProjectsJson(projects = loadProjects()) {
  return JSON.stringify(
    {
      format: 'potolok-planner',
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
    },
    null,
    2,
  );
}

export function importProjectsJson(raw: string, existing = loadProjects()) {
  const parsed = JSON.parse(raw) as {
    format?: string;
    version?: number;
    projects?: CeilingProject[];
  };
  if (parsed.format !== 'potolok-planner' || !Array.isArray(parsed.projects)) {
    throw new Error('Неверный файл резервной копии Potolok Planner');
  }

  const valid = parsed.projects.filter(
    (project) =>
      project &&
      typeof project.id === 'string' &&
      typeof project.name === 'string' &&
      Array.isArray(project.points) &&
      Array.isArray(project.elements),
  );

  const byId = new Map(existing.map((project) => [project.id, project]));
  valid.forEach((project) => byId.set(project.id, project));
  const next = Array.from(byId.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  saveProjects(next);
  return next;
}
