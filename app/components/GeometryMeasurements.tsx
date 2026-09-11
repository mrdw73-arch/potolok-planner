'use client';

import { angleAt, distance, Point } from '../../lib/geometry';

type Props = {
  points: Point[];
  selectedPoint: number;
  selectedWall: number;
  showAngles?: boolean;
  showDiagonals?: boolean;
};

function mm(value: number) {
  return `${Math.round(value)} мм`;
}

function deg(value: number) {
  return `${Math.round(value)}°`;
}

export default function GeometryMeasurements({
  points,
  selectedPoint,
  selectedWall,
  showAngles = true,
  showDiagonals = true,
}: Props) {
  if (points.length < 2) return null;

  const selected = points[selectedPoint];
  const next = points[(selectedPoint + 1) % points.length];
  const prev = points[(selectedPoint - 1 + points.length) % points.length];
  const angle = points.length >= 3 ? angleAt(prev, selected, next) : 0;
  const oppositeIndex = (selectedPoint + Math.floor(points.length / 2)) % points.length;
  const opposite = points[oppositeIndex];
  const diagonal = distance(selected, opposite);
  const wall = points[selectedWall];
  const wallEnd = points[(selectedWall + 1) % points.length];

  return (
    <g className="geometry-measurements" pointerEvents="none">
      <g className="measurement-badge selected-wall-measurement">
        <text x={0} y={0} className="measurement-label">
          Стена {selectedWall + 1}: {mm(distance(wall, wallEnd))}
        </text>
      </g>
      {showAngles && points.length >= 3 && (
        <g transform={`translate(${selected.x} ${selected.y})`}>
          <circle r="24" className="angle-guide" />
          <text y="-30" textAnchor="middle" className="angle-label">
            {deg(angle)}
          </text>
        </g>
      )}
      {showDiagonals && points.length >= 4 && (
        <g>
          <line
            x1={selected.x}
            y1={selected.y}
            x2={opposite.x}
            y2={opposite.y}
            className="diagonal-guide"
          />
          <text
            x={(selected.x + opposite.x) / 2}
            y={(selected.y + opposite.y) / 2 - 8}
            textAnchor="middle"
            className="diagonal-label"
          >
            {mm(diagonal)}
          </text>
        </g>
      )}
    </g>
  );
}
