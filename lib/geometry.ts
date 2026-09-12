export type Point = { x: number; y: number };

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
  return points.reduce(
    (sum, point, index) => sum + distance(point, points[(index + 1) % points.length]),
    0,
  );
}

export function snap(value: number, step: number) {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

export function snapPoint(point: Point, step: number) {
  return { x: snap(point.x, step), y: snap(point.y, step) };
}

/**
 * Changes one wall while keeping its start vertex fixed and moving the end
 * vertex along the current wall direction. The following vertex is translated
 * by the same delta, preserving the adjacent wall's direction and avoiding a
 * global distortion of the room.
 */
export function resizeWallKeepingAdjacent(
  points: Point[],
  index: number,
  lengthMm: number,
): Point[] {
  if (points.length < 3 || !Number.isFinite(lengthMm) || lengthMm <= 0) return points;

  const nextIndex = (index + 1) % points.length;
  const followingIndex = (nextIndex + 1) % points.length;
  const start = points[index];
  const end = points[nextIndex];
  const following = points[followingIndex];
  const currentLength = distance(start, end);
  if (!currentLength) return points;

  const scale = lengthMm / currentLength;
  const nextEnd = {
    x: Math.round(start.x + (end.x - start.x) * scale),
    y: Math.round(start.y + (end.y - start.y) * scale),
  };
  const delta = { x: nextEnd.x - end.x, y: nextEnd.y - end.y };
  const nextFollowing = {
    x: Math.round(following.x + delta.x),
    y: Math.round(following.y + delta.y),
  };

  return points.map((point, pointIndex) => {
    if (pointIndex === nextIndex) return nextEnd;
    if (pointIndex === followingIndex) return nextFollowing;
    return point;
  });
}
