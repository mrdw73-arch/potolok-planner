export type Point = { x: number; y: number };

export const MIN_WALL_MM = 100;
export const SNAP_MM = 10;

export function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleAt(prev: Point, current: Point, next: Point) {
  const ax = prev.x - current.x;
  const ay = prev.y - current.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;
  const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (!denominator) return 0;
  const cosine = Math.min(1, Math.max(-1, (ax * bx + ay * by) / denominator));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function angleAtVertex(points: Point[], index: number) {
  if (points.length < 3) return 0;
  const i = ((index % points.length) + points.length) % points.length;
  return angleAt(
    points[(i - 1 + points.length) % points.length],
    points[i],
    points[(i + 1) % points.length],
  );
}

export function diagonalLength(a: Point, b: Point) {
  return distance(a, b);
}

export function polygonArea(points: Point[]) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonPerimeter(points: Point[]) {
  if (points.length < 2) return 0;
  return points.reduce(
    (sum, point, index) => sum + distance(point, points[(index + 1) % points.length]),
    0,
  );
}

export function wallLengths(points: Point[]) {
  return points.map((point, index) => distance(point, points[(index + 1) % points.length]));
}

export function roomBounds(points: Point[]) {
  if (!points.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

export function snap(value: number, step = SNAP_MM) {
  if (!Number.isFinite(value) || !step || step <= 0) return value;
  return Math.round(value / step) * step;
}

export function snapPoint(point: Point, step = SNAP_MM) {
  return { x: snap(point.x, step), y: snap(point.y, step) };
}

/**
 * Changes one wall to an exact target length while keeping its current direction.
 * The wall's end vertex moves; the rest of the polygon stays unchanged.
 */
export function setWallLength(points: Point[], wallIndex: number, targetLength: number) {
  if (points.length < 2) return points;
  const i = ((wallIndex % points.length) + points.length) % points.length;
  const endIndex = (i + 1) % points.length;
  const start = points[i];
  const end = points[endIndex];
  const currentLength = distance(start, end);
  const length = Math.max(MIN_WALL_MM, Math.round(targetLength));

  if (!Number.isFinite(length) || !currentLength) return points;

  const dx = (end.x - start.x) / currentLength;
  const dy = (end.y - start.y) / currentLength;
  const next = points.map((point) => ({ ...point }));
  next[endIndex] = {
    x: Math.round(start.x + dx * length),
    y: Math.round(start.y + dy * length),
  };
  return next;
}
