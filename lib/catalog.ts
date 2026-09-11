import { CatalogItem } from './ceiling-model';

export const defaultCatalog: CatalogItem[] = [
  { id: 'canvas', name: 'Полотно ПВХ', category: 'Полотно', materialOrWork: 'material', unit: 'м²', salePrice: 900, costPrice: 500, shape: 'square', active: true },
  { id: 'profile', name: 'Профиль', category: 'Профиль', materialOrWork: 'material', unit: 'м', salePrice: 350, costPrice: 190, shape: 'line', active: true },
  { id: 'insert', name: 'Декоративная вставка', category: 'Комплектующие', materialOrWork: 'material', unit: 'м', salePrice: 120, costPrice: 60, shape: 'line', active: true },
  { id: 'spot', name: 'Светильник', category: 'Свет', materialOrWork: 'material', unit: 'шт', salePrice: 700, costPrice: 350, shape: 'circle', size: 28, active: true },
  { id: 'chandelier', name: 'Люстра', category: 'Свет', materialOrWork: 'material', unit: 'шт', salePrice: 1200, costPrice: 700, shape: 'circle', size: 44, active: true },
  { id: 'cornice', name: 'Карниз', category: 'Карнизы', materialOrWork: 'material', unit: 'м', salePrice: 650, costPrice: 320, shape: 'line', active: true },
  { id: 'light-line', name: 'Световая линия', category: 'Свет', materialOrWork: 'material', unit: 'м', salePrice: 1800, costPrice: 950, shape: 'line', active: true },
  { id: 'installation', name: 'Монтаж натяжного потолка', category: 'Работы', materialOrWork: 'work', unit: 'м²', salePrice: 500, costPrice: 300, shape: 'text', active: true },
];

export function findCatalogItem(items: CatalogItem[], id: string) {
  return items.find((item) => item.id === id);
}

export function duplicateCatalogItem(item: CatalogItem): CatalogItem {
  return { ...item, id: `${item.id}-${Date.now()}`, name: `${item.name} — копия` };
}
