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

export function orthogonalizeRoom(points: Point[]): Point[] {
  if (points.length < 4) return points;

  const result = points.map((point) => ({ ...point }));
  const anchor = result[0];

  for (let i = 1; i < result.length; i += 1) {
    const previous = result[i - 1];
    const original = points[i];
    const dx = original.x - points[i - 1].x;
    const dy = original.y - points[i - 1].y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      result[i] = { x: original.x, y: previous.y };
    } else {
      result[i] = { x: previous.x, y: original.y };
    }
  }

  const last = result[result.length - 1];
  result[0] = anchor;
  result[result.length - 1] = { x: anchor.x, y: last.y };
  return result;
}

/**
 * Resizes a 4-corner orthogonal room and keeps the opposite wall synchronized.
 * The expected order is clockwise or counter-clockwise around the room.
 */
export function resizeOrthogonalWall(points: Point[], index: number, lengthMm: number): Point[] {
  if (points.length !== 4 || !Number.isFinite(lengthMm) || lengthMm <= 0) return points;

  const next = (index + 1) % 4;
  const opposite = (index + 2) % 4;
  const oppositeNext = (index + 3) % 4;
  const result = points.map((point) => ({ ...point }));
  const start = points[index];
  const end = points[next];
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);

  if (horizontal) {
    const direction = end.x >= start.x ? 1 : -1;
    const newEndX = Math.round(start.x + direction * lengthMm);
    const delta = newEndX - end.x;
    result[next] = { x: newEndX, y: start.y };
    result[opposite] = { x: points[opposite].x + delta, y: points[opposite].y };
    result[oppositeNext] = { x: points[oppositeNext].x + delta, y: points[oppositeNext].y };
  } else {
    const direction = end.y >= start.y ? 1 : -1;
    const newEndY = Math.round(start.y + direction * lengthMm);
    const delta = newEndY - end.y;
    result[next] = { x: start.x, y: newEndY };
    result[opposite] = { x: points[opposite].x, y: points[opposite].y + delta };
    result[oppositeNext] = { x: points[oppositeNext].x, y: points[oppositeNext].y + delta };
  }

  return orthogonalizeRoom(result);
}
