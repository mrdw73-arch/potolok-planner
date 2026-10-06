import { angleAt, distance, Point, polygonPerimeter } from './geometry';

export type MeasurementReport = {
  wallLengthsMm: number[];
  anglesDeg: number[];
  perimeterMm: number;
  boundsWidthMm: number;
  boundsHeightMm: number;
  angleSumDeg: number;
  expectedAngleSumDeg: number;
  warnings: string[];
};

export function measurementReport(points: Point[]): MeasurementReport {
  const lengths = points.map((point, index) => Math.round(distance(point, points[(index + 1) % points.length])));
  const angles = points.map((_, index) => Number(angleAt(points[(index - 1 + points.length) % points.length], points[index], points[(index + 1) % points.length]).toFixed(1)));
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const width = points.length ? Math.max(...xs) - Math.min(...xs) : 0;
  const height = points.length ? Math.max(...ys) - Math.min(...ys) : 0;
  const perimeter = Math.round(polygonPerimeter(points));
  const angleSum = Number(angles.reduce((sum, value) => sum + value, 0).toFixed(1));
  const expectedAngleSum = Math.max(0, (points.length - 2) * 180);
  const warnings: string[] = [];
  if (points.length < 3) warnings.push('Нужно минимум 3 точки.');
  if (lengths.some(value => value < 100)) warnings.push('Есть стена короче 100 мм.');
  if (angles.some(value => value < 10 || value > 350)) warnings.push('Есть подозрительно острый или вырожденный угол.');
  if (points.length >= 3 && Math.abs(angleSum - expectedAngleSum) > 2) warnings.push('Сумма углов не сходится с количеством вершин — проверьте контур.');
  if (points.length >= 3 && (width < 100 || height < 100)) warnings.push('Одна из габаритных сторон помещения меньше 100 мм.');
  return { wallLengthsMm: lengths, anglesDeg: angles, perimeterMm: perimeter, boundsWidthMm: Math.round(width), boundsHeightMm: Math.round(height), angleSumDeg: angleSum, expectedAngleSumDeg: expectedAngleSum, warnings };
}

export function diagonalMatrix(points: Point[]) {
  const result: Array<{ from: number; to: number; lengthMm: number }> = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 2; j < points.length; j += 1) {
      if (i === 0 && j === points.length - 1) continue;
      result.push({ from: i + 1, to: j + 1, lengthMm: Math.round(distance(points[i], points[j])) });
    }
  }
  return result;
}
