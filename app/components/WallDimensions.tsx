'use client';

import { useMemo } from 'react';

type Point = { x: number; y: number };

type Props = {
  points: Point[];
  width: number;
  height: number;
};

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function formatMm(value: number) {
  return `${Math.round(value)} мм`;
}

export default function WallDimensions({ points, width, height }: Props) {
  const dimensions = useMemo(() => {
    if (points.length < 2) return [];

    return points.map((point, index) => {
      const next = points[(index + 1) % points.length];
      const length = distance(point, next);
      const dx = next.x - point.x;
      const dy = next.y - point.y;
      const angle = Math.atan2(dy, dx);
      const offset = 18;
      const midX = (point.x + next.x) / 2;
      const midY = (point.y + next.y) / 2;
      const nx = -Math.sin(angle) * offset;
      const ny = Math.cos(angle) * offset;

      return {
        index,
        text: formatMm(length),
        x: ((midX + nx) / width) * 100,
        y: ((midY + ny) / height) * 100,
      };
    });
  }, [points, width, height]);

  return (
    <g className="wall-dimensions" pointerEvents="none">
      {dimensions.map((dimension) => (
        <g key={dimension.index}>
          <rect
            x={`${dimension.x - 4}%`}
            y={`${dimension.y - 3}%`}
            width="8%"
            height="6%"
            rx="4"
            className="dimension-bg"
          />
          <text
            x={`${dimension.x}%`}
            y={`${dimension.y}%`}
            textAnchor="middle"
            dominantBaseline="middle"
            className="dimension-text"
          >
            {dimension.text}
          </text>
        </g>
      ))}
    </g>
  );
}
