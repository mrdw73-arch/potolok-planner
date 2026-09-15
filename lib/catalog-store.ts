import { CatalogItem, defaultCatalog } from './catalog';

const KEY = 'potolok-planner-catalog-v1';

export function loadCatalog(): CatalogItem[] {
  if (typeof window === 'undefined') return [...defaultCatalog];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [...defaultCatalog];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...defaultCatalog];
    return parsed.filter((item): item is CatalogItem =>
      item && typeof item.id === 'string' && typeof item.name === 'string' &&
      (item.category === 'material' || item.category === 'work') &&
      (item.unit === 'м²' || item.unit === 'м.п.' || item.unit === 'шт.') &&
      Number.isFinite(item.costPrice) && Number.isFinite(item.sellPrice)
    );
  } catch {
    return [...defaultCatalog];
  }
}

export function saveCatalog(catalog: CatalogItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(catalog));
}

export function upsertCatalogItem(item: CatalogItem, catalog = loadCatalog()) {
  const next = catalog.some((x) => x.id === item.id)
    ? catalog.map((x) => x.id === item.id ? item : x)
    : [...catalog, item];
  saveCatalog(next);
  return next;
}

export function removeCatalogItem(id: string, catalog = loadCatalog()) {
  const next = catalog.filter((item) => item.id !== id);
  saveCatalog(next);
  return next;
}

export function resetCatalog() {
  const next = [...defaultCatalog];
  saveCatalog(next);
  return next;
}
