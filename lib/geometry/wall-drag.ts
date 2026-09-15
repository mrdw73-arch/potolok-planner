import type { DrawPoint } from './drawing';
import { moveSegment, snapDrawingPoint } from './drawing';

export type WallDragOptions = {
  orthogonal?: boolean;
  grid?: number;
  minLength?: number;
};

function wallVector(a: DrawPoint, b: DrawPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  return { dx, dy, length };
}

/**
 * Projects a pointer delta onto the wall normal. This is the CAD behaviour
 * used when a whole wall is moved: the wall stays parallel to itself and its
 * two endpoints move together.
 */
export function projectWallDelta(
  points: DrawPoint[],
  wallIndex: number,
  delta: DrawPoint,
) {
  if (points.length < 2 || wallIndex < 0 || wallIndex >= points.length) return { x: 0, y: 0 };
  const a = points[wallIndex];
  const b = points[(wallIndex + 1) % points.length];
  const { dx, dy, length } = wallVector(a, b);
  const nx = -dy / length;
  const ny = dx / length;
  const amount = delta.x * nx + delta.y * ny;
  return { x: nx * amount, y: ny * amount };
}

export function dragWall(
  points: DrawPoint[],
  wallIndex: number,
  pointerDelta: DrawPoint,
  options: WallDragOptions = {},
) {
  if (points.length < 2 || wallIndex < 0 || wallIndex >= points.length) return points;

  const rawDelta = options.orthogonal === false
    ? pointerDelta
    : projectWallDelta(points, wallIndex, pointerDelta);
  const grid = options.grid && options.grid > 0 ? options.grid : 1;
  const delta = snapDrawingPoint(rawDelta, grid);
  const next = moveSegment(points, wallIndex, delta);

  if (!options.minLength) return next;

  const min = options.minLength;
  for (let i = 0; i < next.length; i += 1) {
    const a = next[i];
    const b = next[(i + 1) % next.length];
    if (Math.hypot(b.x - a.x, b.y - a.y) < min) return points;
  }
  return next;
}

export function wallNormal(points: DrawPoint[], wallIndex: number) {
  if (points.length < 2 || wallIndex < 0 || wallIndex >= points.length) return { x: 0, y: 0 };
  const a = points[wallIndex];
  const b = points[(wallIndex + 1) % points.length];
  const { dx, dy, length } = wallVector(a, b);
  return { x: -dy / length, y: dx / length };
}
