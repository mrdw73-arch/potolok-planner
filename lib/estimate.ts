export type EstimateInputs = {
  areaM2: number;
  perimeterM: number;
  spotlightCount: number;
  chandelierCount: number;
  corniceCount: number;
  corniceLengthM: number;
  wastePercent: number;
  canvasPricePerM2: number;
  profilePricePerM: number;
  insertPricePerM: number;
  fastenerPricePerM: number;
  spotlightPrice: number;
  chandelierPrice: number;
  cornicePricePerM: number;
};

export type EstimateLine = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
};

export type EstimateResult = {
  lines: EstimateLine[];
  total: number;
  canvasAreaM2: number;
};

export function calculateEstimate(input: EstimateInputs): EstimateResult {
  const canvasAreaM2 = input.areaM2 * (1 + Math.max(0, input.wastePercent) / 100);
  const line = (name: string, quantity: number, unit: string, unitPrice: number): EstimateLine => ({
    name,
    quantity,
    unit,
    unitPrice,
    total: quantity * unitPrice,
  });

  const lines = [
    line('Полотно', canvasAreaM2, 'м²', input.canvasPricePerM2),
    line('Профиль', input.perimeterM, 'м', input.profilePricePerM),
    line('Вставка', input.perimeterM, 'м', input.insertPricePerM),
    line('Крепёж', input.perimeterM, 'м', input.fastenerPricePerM),
    line('Светильники', input.spotlightCount, 'шт.', input.spotlightPrice),
    line('Люстры', input.chandelierCount, 'шт.', input.chandelierPrice),
    line('Карниз', input.corniceLengthM, 'м', input.cornicePricePerM),
  ].filter(item => item.quantity > 0 || item.name === 'Полотно' || item.name === 'Профиль' || item.name === 'Вставка' || item.name === 'Крепёж');

  return { lines, total: lines.reduce((sum, item) => sum + item.total, 0), canvasAreaM2 };
}
