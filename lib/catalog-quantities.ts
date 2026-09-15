import type { CatalogItem } from './catalog';

type PlannerElement = {
  type: 'spot' | 'chandelier' | 'lightLine' | 'cornice';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
};

type Point = { x: number; y: number };

export type CatalogQuantities = Record<string, number>;

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function calculateCatalogQuantities(
  pointsMm: Point[],
  elements: PlannerElement[],
  catalog: CatalogItem[],
): CatalogQuantities {
  const quantities: CatalogQuantities = {};
  const set = (id: string, value: number) => {
    if (catalog.some(item => item.id === id)) quantities[id] = Math.max(0, Number(value.toFixed(2)));
  };

  if (pointsMm.length >= 3) {
    let twiceArea = 0;
    let perimeterMm = 0;
    for (let i = 0; i < pointsMm.length; i += 1) {
      const a = pointsMm[i];
      const b = pointsMm[(i + 1) % pointsMm.length];
      twiceArea += a.x * b.y - b.x * a.y;
      perimeterMm += distance(a, b);
    }
    const areaM2 = Math.abs(twiceArea) / 2 / 1_000_000;
    const perimeterM = perimeterMm / 1000;
    set('canvas', areaM2 * 1.07);
    set('profile', perimeterM);
    set('insert', perimeterM);
    set('fastener', perimeterM);
    set('installation', areaM2);
  }

  const spots = elements.filter(x => x.type === 'spot').length;
  const chandeliers = elements.filter(x => x.type === 'chandelier').length;
  set('spot', spots);
  set('chandelier', chandeliers);

  const segmentLength = (element: PlannerElement) =>
    element.x2 === undefined || element.y2 === undefined
      ? 0
      : distance({ x: element.x, y: element.y }, { x: element.x2, y: element.y2 }) / 1000;

  set('lightLine', elements.filter(x => x.type === 'lightLine').reduce((sum, x) => sum + segmentLength(x), 0));
  set('cornice', elements.filter(x => x.type === 'cornice').reduce((sum, x) => sum + segmentLength(x), 0));

  return quantities;
}

export function mergeCatalogOverrides(
  automatic: CatalogQuantities,
  overrides: CatalogQuantities,
): CatalogQuantities {
  return { ...automatic, ...overrides };
}
