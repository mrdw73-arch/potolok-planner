'use client';

import { useMemo, useState } from 'react';
import { Point, snapPoint } from '../../lib/geometry';
import { diagonalMatrix, measurementReport } from '../../lib/measurement';

const initialPoints: Point[] = [
  { x: 0, y: 0 },
  { x: 5000, y: 0 },
  { x: 5000, y: 3600 },
  { x: 0, y: 3600 },
];

export default function MeasurementPage() {
  const [points, setPoints] = useState<Point[]>(initialPoints);
  const report = useMemo(() => measurementReport(points), [points]);
  const diagonals = useMemo(() => diagonalMatrix(points), [points]);

  function updatePoint(index: number, axis: 'x' | 'y', value: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    setPoints((current) => current.map((point, i) => i === index ? snapPoint({ ...point, [axis]: Math.max(0, numeric) }) : point));
  }

  function addPoint() {
    const last = points[points.length - 1] || { x: 0, y: 0 };
    setPoints([...points, snapPoint({ x: last.x, y: last.y + 500 })]);
  }

  function removePoint(index: number) {
    if (points.length <= 3) return;
    setPoints(points.filter((_, i) => i !== index));
  }

  function reset() {
    setPoints(initialPoints.map((point) => ({ ...point })));
  }

  return (
    <main style={{ minHeight: '100vh', padding: 24, background: '#f6f7f9', color: '#17191c', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 13, opacity: .6, marginBottom: 5 }}>Potolok Planner</div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Профессиональный замер</h1>
          </div>
          <a href="/" style={{ textDecoration: 'none', color: '#17191c', border: '1px solid #d7dbe0', padding: '10px 14px', borderRadius: 10, background: '#fff' }}>← Конструктор</a>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, .8fr)', gap: 18, alignItems: 'start' }}>
          <div style={{ background: '#fff', border: '1px solid #e0e3e7', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div><strong>Точки замера</strong><div style={{ fontSize: 13, opacity: .6 }}>Все размеры в миллиметрах. Шаг привязки — 10 мм.</div></div>
              <div style={{ display: 'flex', gap: 8 }}><button onClick={addPoint}>＋ Угол</button><button onClick={reset}>Сбросить</button></div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ textAlign: 'left', padding: 10 }}>№</th><th style={{ textAlign: 'left', padding: 10 }}>X, мм</th><th style={{ textAlign: 'left', padding: 10 }}>Y, мм</th><th style={{ textAlign: 'left', padding: 10 }}>Стена, мм</th><th style={{ textAlign: 'left', padding: 10 }}>Угол</th><th /></tr></thead>
                <tbody>
                  {points.map((point, index) => (
                    <tr key={`${index}-${point.x}-${point.y}`} style={{ borderTop: '1px solid #eceef1' }}>
                      <td style={{ padding: 8 }}>{index + 1}</td>
                      <td style={{ padding: 8 }}><input type="number" step={10} value={point.x} onChange={(e) => updatePoint(index, 'x', e.target.value)} style={{ width: 120 }} /></td>
                      <td style={{ padding: 8 }}><input type="number" step={10} value={point.y} onChange={(e) => updatePoint(index, 'y', e.target.value)} style={{ width: 120 }} /></td>
                      <td style={{ padding: 8 }}>{report.wallLengthsMm[index] ?? 0}</td>
                      <td style={{ padding: 8 }}>{report.anglesDeg[index] ?? 0}°</td>
                      <td style={{ padding: 8 }}><button onClick={() => removePoint(index)} disabled={points.length <= 3}>Удалить</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside style={{ display: 'grid', gap: 14 }}>
            <div style={{ background: '#fff', border: '1px solid #e0e3e7', borderRadius: 16, padding: 20 }}>
              <strong>Контроль замера</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
                <Metric title="Ширина" value={`${report.boundsWidthMm} мм`} />
                <Metric title="Высота" value={`${report.boundsHeightMm} мм`} />
                <Metric title="Периметр" value={`${report.perimeterMm} мм`} />
                <Metric title="Сумма углов" value={`${report.angleSumDeg}°`} />
              </div>
              <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: report.warnings.length ? '#fff4e5' : '#eef8f0' }}>
                <strong>{report.warnings.length ? 'Есть замечания' : 'Замер выглядит корректно'}</strong>
                {report.warnings.length > 0 && <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e0e3e7', borderRadius: 16, padding: 20 }}>
              <strong>Диагонали</strong>
              <div style={{ fontSize: 13, opacity: .6, margin: '5px 0 12px' }}>Контрольные размеры для сложных помещений.</div>
              {diagonals.length === 0 ? <div style={{ opacity: .6 }}>Для этого контура диагоналей нет.</div> : diagonals.map((diagonal) => <div key={`${diagonal.from}-${diagonal.to}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #eceef1' }}><span>Точка {diagonal.from} → {diagonal.to}</span><strong>{diagonal.lengthMm} мм</strong></div>)}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div style={{ border: '1px solid #eceef1', borderRadius: 10, padding: 10 }}><div style={{ fontSize: 12, opacity: .55 }}>{title}</div><strong>{value}</strong></div>;
}
