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

/** Creates a point from a start point, millimetre length and angle in degrees. */
export function pointFromLengthAngle(start: Point, lengthMm: number, angleDeg: number): Point {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: start.x + lengthMm * Math.cos(angle),
    y: start.y - lengthMm * Math.sin(angle),
  };
}

/** Returns the direction angle of a segment in degrees, using the ceiling editor's screen convention. */
export function segmentAngle(a: Point, b: Point) {
  return (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
}

/** Formats a millimetre value for compact dimension labels. */
export function formatDimension(lengthMm: number) {
  if (!Number.isFinite(lengthMm)) return '—';
  if (Math.abs(lengthMm) >= 1000) return `${(lengthMm / 1000).toFixed(lengthMm % 1000 === 0 ? 0 : 2)} м`;
  return `${Math.round(lengthMm)} мм`;
}

/** Projects a point onto a segment and returns the closest point plus normalized position t. */
export function projectPointToSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return { point: { ...a }, t: 0 };
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return { point: { x: a.x + dx * t, y: a.y + dy * t }, t };
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

/** Converts common ceiling dimensions to millimetres: 3500, 3500 mm, 350 cm, 3.5 m. */
export function parseDimension(value: string) {
  const normalized = value.trim().toLowerCase().replace(',', '.');
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*(mm|см|cm|м|m)?$/i);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number <= 0) return null;
  const unit = match[2] ?? 'mm';
  if (unit === 'm' || unit === 'м') return number * 1000;
  if (unit === 'cm' || unit === 'см') return number * 10;
  return number;
}

/** Resizes one side while translating the following vertex so the adjacent side stays attached. */
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

/** Resizes a 4-corner orthogonal room and keeps the opposite wall synchronized. */
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
