import type { ProjectElement, ProjectPoint, ProjectPrices } from './project';

export type EstimateLine = {
  id: string;
  name: string;
  unit: 'м²' | 'м.п.' | 'шт.';
  quantity: number;
  costPrice: number;
  sellPrice: number;
  costTotal: number;
  sellTotal: number;
  margin: number;
};

export type EstimateSummary = {
  areaM2: number;
  perimeterM: number;
  diagonalM: number;
  wasteM2: number;
  materialCost: number;
  materialSell: number;
  laborCost: number;
  laborSell: number;
  totalCost: number;
  totalSell: number;
  margin: number;
  marginPercent: number;
  lines: EstimateLine[];
};

const DEFAULTS = {
  canvasPricePerM2: 900,
  profilePricePerM: 350,
  insertPricePerM: 120,
  fastenerPricePerM: 45,
  spotlightPrice: 700,
  chandelierPrice: 1200,
  lightLinePricePerM: 950,
  cornicePricePerM: 650,
  wastePercent: 7,
  laborPricePerM2: 500,
};

function distance(a: ProjectPoint, b: ProjectPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function polygonArea(points: ProjectPoint[]) {
  if (points.length < 3) return 0;
  const sum = points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0);
  return Math.abs(sum) / 2;
}

export function polygonPerimeter(points: ProjectPoint[]) {
  if (points.length < 2) return 0;
  return points.reduce((total, point, index) => total + distance(point, points[(index + 1) % points.length]), 0);
}

function addLine(lines: EstimateLine[], line: Omit<EstimateLine, 'costTotal' | 'sellTotal' | 'margin'>) {
  if (line.quantity <= 0) return;
  lines.push({
    ...line,
    costTotal: line.quantity * line.costPrice,
    sellTotal: line.quantity * line.sellPrice,
    margin: line.quantity * (line.sellPrice - line.costPrice),
  });
}

export function calculateEstimate(
  points: ProjectPoint[],
  elements: ProjectElement[],
  prices: Partial<ProjectPrices> = {},
  quantityOverrides: Record<string, number> = {},
): EstimateSummary {
  const p = { ...DEFAULTS, ...prices };
  const areaM2 = polygonArea(points) / 10000;
  const perimeterM = polygonPerimeter(points) / 100;
  const wasteM2 = areaM2 * Math.max(0, p.wastePercent) / 100;

  const spots = elements.filter((element) => element.type === 'spot').length;
  const chandeliers = elements.filter((element) => element.type === 'chandelier').length;
  const corniceLengthM = elements
    .filter((element) => element.type === 'cornice')
    .reduce((sum, element) => sum + (element.x2 === undefined || element.y2 === undefined ? 0 : distance(element, { x: element.x2, y: element.y2 }) / 100), 0);
  const lightLineLengthM = elements
    .filter((element) => element.type === 'lightLine')
    .reduce((sum, element) => sum + (element.x2 === undefined || element.y2 === undefined ? 0 : distance(element, { x: element.x2, y: element.y2 }) / 100), 0);

  const lines: EstimateLine[] = [];
  const quantity = (id: string, fallback: number) => Math.max(0, quantityOverrides[id] ?? fallback);

  addLine(lines, { id: 'canvas', name: 'ПВХ полотно', unit: 'м²', quantity: quantity('canvas', areaM2 + wasteM2), costPrice: 420, sellPrice: p.canvasPricePerM2 });
  addLine(lines, { id: 'profile', name: 'Профиль', unit: 'м.п.', quantity: quantity('profile', perimeterM), costPrice: 170, sellPrice: p.profilePricePerM });
  addLine(lines, { id: 'insert', name: 'Вставка', unit: 'м.п.', quantity: quantity('insert', perimeterM), costPrice: 55, sellPrice: p.insertPricePerM });
  addLine(lines, { id: 'fastener', name: 'Крепёж', unit: 'м.п.', quantity: quantity('fastener', perimeterM), costPrice: 20, sellPrice: p.fastenerPricePerM });
  addLine(lines, { id: 'spot', name: 'Точечные светильники', unit: 'шт.', quantity: quantity('spot', spots), costPrice: 380, sellPrice: p.spotlightPrice });
  addLine(lines, { id: 'chandelier', name: 'Закладные под люстру', unit: 'шт.', quantity: quantity('chandelier', chandeliers), costPrice: 650, sellPrice: p.chandelierPrice });
  addLine(lines, { id: 'lightLine', name: 'Световая линия', unit: 'м.п.', quantity: quantity('lightLine', lightLineLengthM), costPrice: 480, sellPrice: p.lightLinePricePerM });
  addLine(lines, { id: 'cornice', name: 'Карниз', unit: 'м.п.', quantity: quantity('cornice', corniceLengthM), costPrice: 320, sellPrice: p.cornicePricePerM });
  addLine(lines, { id: 'installation', name: 'Монтаж потолка', unit: 'м²', quantity: quantity('installation', areaM2), costPrice: 220, sellPrice: p.laborPricePerM2 });

  const materialLines = lines.filter((line) => line.id !== 'installation');
  const laborLines = lines.filter((line) => line.id === 'installation');
  const materialCost = materialLines.reduce((sum, line) => sum + line.costTotal, 0);
  const materialSell = materialLines.reduce((sum, line) => sum + line.sellTotal, 0);
  const laborCost = laborLines.reduce((sum, line) => sum + line.costTotal, 0);
  const laborSell = laborLines.reduce((sum, line) => sum + line.sellTotal, 0);
  const totalCost = materialCost + laborCost;
  const totalSell = materialSell + laborSell;
  const margin = totalSell - totalCost;

  return {
    areaM2,
    perimeterM,
    diagonalM: points.length === 4 ? distance(points[0], points[2]) / 100 : 0,
    wasteM2,
    materialCost,
    materialSell,
    laborCost,
    laborSell,
    totalCost,
    totalSell,
    margin,
    marginPercent: totalSell > 0 ? (margin / totalSell) * 100 : 0,
    lines,
  };
}
