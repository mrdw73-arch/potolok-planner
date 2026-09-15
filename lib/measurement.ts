import { angleAtVertex, distance, Point, polygonPerimeter, roomBounds, wallLengths } from './geometry';

export type MeasurementReport = {
  wallLengthsMm: number[];
  anglesDeg: number[];
  perimeterMm: number;
  boundsWidthMm: number;
  boundsHeightMm: number;
  closureErrorMm: number;
  isClosed: boolean;
  warnings: string[];
};

export function measurementReport(points: Point[]): MeasurementReport {
  const lengths = wallLengths(points).map(Math.round);
  const angles = points.map((_, index) => Number(angleAtVertex(points, index).toFixed(1)));
  const perimeter = Math.round(polygonPerimeter(points));
  const bounds = roomBounds(points);

  let closureError = 0;
  if (points.length >= 2) {
    const first = points[0];
    const last = points[points.length - 1];
    closureError = Math.round(distance(first, last));
  }

  const warnings: string[] = [];
  if (points.length < 3) warnings.push('Нужно минимум 3 точки.');
  if (lengths.some((value) => value < 100)) warnings.push('Есть стена короче 100 мм.');
  if (angles.some((value) => value < 10 || value > 350)) warnings.push('Есть подозрительно острый или вырожденный угол.');
  if (points.length >= 3 && Math.abs(bounds.width) < 100 && Math.abs(bounds.height) < 100) {
    warnings.push('Размер помещения слишком мал для корректного замера.');
  }

  return {
    wallLengthsMm: lengths,
    anglesDeg: angles,
    perimeterMm: perimeter,
    boundsWidthMm: Math.round(bounds.width),
    boundsHeightMm: Math.round(bounds.height),
    closureErrorMm: closureError,
    isClosed: points.length >= 3 && closureError <= 10,
    warnings,
  };
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
