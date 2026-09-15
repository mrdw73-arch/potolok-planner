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

export function sideLengthMm(points: Point[], index: number): number {
  if (!points.length) return 0;
  const a = points[index];
  const b = points[(index + 1) % points.length];
  return a && b ? distance(a, b) : 0;
}

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

export type TriangleSolveResult =
  | { ok: true; point: Point }
  | { ok: false; reason: 'invalid-sides' | 'no-intersection' | 'ambiguous' };

/** Finds circle intersections for two fixed vertices and two exact side lengths. */
export function circleIntersections(a: Point, ra: number, b: Point, rb: number): Point[] {
  if (!Number.isFinite(ra) || !Number.isFinite(rb) || ra <= 0 || rb <= 0) return [];
  const d = distance(a, b);
  if (!d || d > ra + rb || d < Math.abs(ra - rb)) return [];
  const along = (ra * ra - rb * rb + d * d) / (2 * d);
  const heightSquared = ra * ra - along * along;
  if (heightSquared < -0.001) return [];
  const height = Math.sqrt(Math.max(0, heightSquared));
  const ux = (b.x - a.x) / d;
  const uy = (b.y - a.y) / d;
  const base = { x: a.x + ux * along, y: a.y + uy * along };
  const offset = { x: -uy * height, y: ux * height };
  const first = { x: base.x + offset.x, y: base.y + offset.y };
  if (height < 0.001) return [first];
  return [first, { x: base.x - offset.x, y: base.y - offset.y }];
}

export function solveTrianglePoint(
  a: Point,
  b: Point,
  sideA: number,
  sideB: number,
  prefer?: Point,
): TriangleSolveResult {
  if (!Number.isFinite(sideA) || !Number.isFinite(sideB) || sideA <= 0 || sideB <= 0) {
    return { ok: false, reason: 'invalid-sides' };
  }
  const candidates = circleIntersections(a, sideA, b, sideB);
  if (!candidates.length) return { ok: false, reason: 'no-intersection' };
  if (candidates.length === 1 || !prefer) return { ok: true, point: candidates[0] };
  const first = distance(candidates[0], prefer);
  const second = distance(candidates[1], prefer);
  if (Math.abs(first - second) < 0.001) return { ok: false, reason: 'ambiguous' };
  return { ok: true, point: first < second ? candidates[0] : candidates[1] };
}

/** Rebuilds a quadrilateral from a diagonal while preserving its four side lengths. */
export function rebuildQuadrilateralByDiagonal(
  points: Point[],
  diagonalLength: number,
  diagonalIndex = 0,
): { ok: true; points: Point[] } | { ok: false; reason: string } {
  if (points.length !== 4 || !Number.isFinite(diagonalLength) || diagonalLength <= 0) {
    return { ok: false, reason: 'Нужно ровно 4 вершины и корректная длина диагонали.' };
  }
  const aIndex = diagonalIndex === 0 ? 0 : 1;
  const cIndex = (aIndex + 2) % 4;
  const bIndex = (aIndex + 1) % 4;
  const dIndex = (aIndex + 3) % 4;
  const a = points[aIndex];
  const c = points[cIndex];
  const currentDiagonal = distance(a, c);
  if (!currentDiagonal) return { ok: false, reason: 'Диагональ нулевой длины.' };

  const ab = distance(a, points[bIndex]);
  const cb = distance(c, points[bIndex]);
  const ad = distance(a, points[dIndex]);
  const cd = distance(c, points[dIndex]);
  const rebuiltC = {
    x: a.x + ((c.x - a.x) * diagonalLength) / currentDiagonal,
    y: a.y + ((c.y - a.y) * diagonalLength) / currentDiagonal,
  };
  const bResult = solveTrianglePoint(a, rebuiltC, ab, cb, points[bIndex]);
  const dResult = solveTrianglePoint(a, rebuiltC, ad, cd, points[dIndex]);
  if (!bResult.ok || !dResult.ok) return { ok: false, reason: 'Новая диагональ несовместима с длинами сторон.' };

  const result = points.map((p) => ({ ...p }));
  result[aIndex] = { ...a };
  result[cIndex] = rebuiltC;
  result[bIndex] = bResult.point;
  result[dIndex] = dResult.point;
  return { ok: true, points: result };
}
