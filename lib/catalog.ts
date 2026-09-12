export type CatalogCategory = 'material' | 'work';
export type CatalogItem = {
  id: string;
  name: string;
  category: CatalogCategory;
  unit: 'м²' | 'м.п.' | 'шт.';
  costPrice: number;
  sellPrice: number;
};

export const defaultCatalog: CatalogItem[] = [
  { id: 'canvas', name: 'ПВХ полотно', category: 'material', unit: 'м²', costPrice: 420, sellPrice: 900 },
  { id: 'profile', name: 'Профиль', category: 'material', unit: 'м.п.', costPrice: 170, sellPrice: 350 },
  { id: 'insert', name: 'Вставка', category: 'material', unit: 'м.п.', costPrice: 55, sellPrice: 120 },
  { id: 'fastener', name: 'Крепёж', category: 'material', unit: 'м.п.', costPrice: 20, sellPrice: 45 },
  { id: 'spot', name: 'Точечный светильник', category: 'material', unit: 'шт.', costPrice: 380, sellPrice: 700 },
  { id: 'chandelier', name: 'Закладная под люстру', category: 'material', unit: 'шт.', costPrice: 650, sellPrice: 1200 },
  { id: 'cornice', name: 'Карниз', category: 'material', unit: 'м.п.', costPrice: 320, sellPrice: 650 },
  { id: 'installation', name: 'Монтаж потолка', category: 'work', unit: 'м²', costPrice: 220, sellPrice: 500 },
];

export type EstimateLine = CatalogItem & { quantity: number; total: number; margin: number };

export function buildEstimate(catalog: CatalogItem[], quantities: Record<string, number>): EstimateLine[] {
  return catalog
    .map((item) => {
      const quantity = Math.max(0, quantities[item.id] ?? 0);
      return { ...item, quantity, total: quantity * item.sellPrice, margin: quantity * (item.sellPrice - item.costPrice) };
    })
    .filter((item) => item.quantity > 0);
}
