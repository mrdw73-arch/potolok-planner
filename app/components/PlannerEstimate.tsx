'use client';

import EstimateDrawer from './EstimateDrawer';
import { defaultCatalog } from '../../lib/catalog';
import { calculateCatalogQuantities, mergeCatalogOverrides } from '../../lib/catalog-quantities';
import { useMemo, useState } from 'react';

type Point = { x: number; y: number };
type Item = { type: 'spot'|'chandelier'|'lightLine'|'cornice'; x:number; y:number; x2?:number; y2?:number };

export default function PlannerEstimate({ points, items }: { points: Point[]; items: Item[] }) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const automatic = useMemo(() => calculateCatalogQuantities(points.map(p => ({ x: p.x * 10, y: p.y * 10 })), items.map(item => ({ ...item, x: item.x * 10, y: item.y * 10, x2: item.x2 === undefined ? undefined : item.x2 * 10, y2: item.y2 === undefined ? undefined : item.y2 * 10 })), defaultCatalog), [points, items]);
  const quantities = useMemo(() => mergeCatalogOverrides(automatic, overrides), [automatic, overrides]);
  return <EstimateDrawer items={defaultCatalog} quantities={quantities} onQuantityChange={(id, value) => setOverrides(current => ({ ...current, [id]: Math.max(0, value) }))} />;
}
