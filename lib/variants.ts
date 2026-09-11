import { CeilingVariant } from './ceiling-model';

export function createVariant(name = 'Новый вариант', points = []): CeilingVariant {
  const now = new Date().toISOString();
  return {
    id: `variant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    points: points.map((point) => ({ ...point })),
    elements: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateVariant(variant: CeilingVariant, name?: string): CeilingVariant {
  const now = new Date().toISOString();
  return {
    ...variant,
    id: `variant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name || `${variant.name} — копия`,
    points: variant.points.map((point) => ({ ...point })),
    segments: variant.segments?.map((segment) => ({
      ...segment,
      start: { ...segment.start },
      end: { ...segment.end },
    })),
    elements: variant.elements.map((element) => ({ ...element })),
    backgroundImage: variant.backgroundImage ? { ...variant.backgroundImage } : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateVariant(variant: CeilingVariant, patch: Partial<CeilingVariant>): CeilingVariant {
  return {
    ...variant,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}
