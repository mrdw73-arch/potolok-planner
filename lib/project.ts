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
};
export type CeilingProject = {
  id: string;
  name: string;
  updatedAt: string;
  points: ProjectPoint[];
  elements: ProjectElement[];
  prices: ProjectPrices;
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
