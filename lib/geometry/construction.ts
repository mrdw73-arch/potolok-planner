import { Point, distance, pointFromLengthAngle } from './geometry';

export type SideConstraint = {
  start: number;
  end: number;
  lengthMm?: number;
  angleDeg?: number;
};

/** Build a new vertex from an existing vertex using an exact length and screen/CAD angle. */
export function buildPointByLengthAngle(start: Point, lengthMm: number, angleDeg: number): Point {
  if (!Number.isFinite(lengthMm) || lengthMm <= 0) return { ...start };
  return pointFromLengthAngle(start, lengthMm, angleDeg);
}

/**
 * Insert a side after `startIndex` using a precise length and angle.
 * Existing vertices after the insertion are preserved; callers can then
 * apply their preferred room-closure/constraint strategy.
 */
export function insertSideByLengthAngle(
  points: Point[],
  startIndex: number,
  lengthMm: number,
  angleDeg: number,
): Point[] {
  if (points.length < 2 || startIndex < 0 || startIndex >= points.length) return points;
  const start = points[startIndex];
  const next = buildPointByLengthAngle(start, lengthMm, angleDeg);
  return [...points.slice(0, startIndex + 1), next, ...points.slice(startIndex + 1)];
}

/** Return the side length in millimetres. */
export function sideLengthMm(points: Point[], index: number): number {
  if (!points.length) return 0;
  const a = points[index];
  const b = points[(index + 1) % points.length];
  return a && b ? distance(a, b) : 0;
}

/**
 * Check whether a polygon has enough geometry to be closed without a
 * zero-length side. This is intentionally lightweight so it can be used
 * while the user is still constructing a contour.
 */
export function validateContour(points: Point[]): string[] {
  const errors: string[] = [];
  if (points.length < 3) errors.push('Контур должен содержать минимум 3 точки');
  points.forEach((point, index) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) errors.push(`Точка №${index + 1}: некорректные координаты`);
  });
  for (let i = 0; i < points.length; i += 1) {
    if (sideLengthMm(points, i) < 1) errors.push(`Сторона №${i + 1}: длина должна быть больше 0`);
  }
  return errors;
}
