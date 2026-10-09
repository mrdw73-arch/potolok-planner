'use client';

import { Dispatch, SetStateAction, useMemo } from 'react';
import { Point, snapPoint } from '../../lib/geometry';
import { diagonalMatrix, measurementReport } from '../../lib/measurement';

type Props = {
  points: Point[];
  setPoints: Dispatch<SetStateAction<Point[]>>;
  onBack: () => void;
};

export default function ProfessionalMeasurement({ points, setPoints, onBack }: Props) {
  const report = useMemo(() => measurementReport(points), [points]);
  const diagonals = useMemo(() => diagonalMatrix(points), [points]);

  function updatePoint(index: number, axis: 'x' | 'y', value: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    setPoints(current => current.map((point, i) =>
      i === index ? snapPoint({ ...point, [axis]: Math.max(0, numeric) }) : point,
    ));
  }

  function addPoint() {
    const last = points[points.length - 1] ?? { x: 0, y: 0 };
    setPoints(current => [...current, snapPoint({ x: last.x, y: last.y + 500 })]);
  }

  function removePoint(index: number) {
    if (points.length <= 3) return;
    setPoints(current => current.filter((_, i) => i !== index));
  }

  function reset() {
    setPoints([{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 3600 }, { x: 0, y: 3600 }]);
  }

  return <div className="professional-measurement">
    <div className="measurement-head">
      <div><h2>Профессиональный замер</h2><p>Контрольные размеры, углы и диагонали. Все значения в миллиметрах.</p></div>
      <button className="ghost" onClick={onBack}>← К плану</button>
    </div>
    <div className="measurement-metrics">
      <div><span>Ширина</span><strong>{report.boundsWidthMm} мм</strong></div>
      <div><span>Высота</span><strong>{report.boundsHeightMm} мм</strong></div>
      <div><span>Периметр</span><strong>{report.perimeterMm} мм</strong></div>
      <div><span>Сумма углов</span><strong>{report.angleSumDeg}°</strong></div>
    </div>
    <div className="measurement-grid">
      <section>
        <div className="section-title">Точки замера</div>
        <div className="measurement-table"><table><thead><tr><th>№</th><th>X, мм</th><th>Y, мм</th><th>Стена, мм</th><th>Угол</th><th /></tr></thead>
          <tbody>{points.map((point, index) => <tr key={index}><td>{index + 1}</td>
            <td><input type="number" step={10} value={point.x} onChange={e => updatePoint(index, 'x', e.target.value)} /></td>
            <td><input type="number" step={10} value={point.y} onChange={e => updatePoint(index, 'y', e.target.value)} /></td>
            <td>{report.wallLengthsMm[index] ?? 0}</td><td>{report.anglesDeg[index] ?? 0}°</td>
            <td><button className="ghost" onClick={() => removePoint(index)} disabled={points.length <= 3}>Удалить</button></td>
          </tr>)}</tbody>
        </table></div>
        <div className="button-row"><button className="add-button" onClick={addPoint}>＋ Угол</button><button className="ghost" onClick={reset}>Сбросить</button></div>
      </section>
      <aside>
        <div className={`measurement-warning ${report.warnings.length ? 'has-warning' : 'ok'}`}><strong>{report.warnings.length ? 'Есть замечания' : 'Замер выглядит корректно'}</strong>
          {report.warnings.length > 0 && <ul>{report.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
        </div>
        <div className="section-title">Диагонали</div>
        <div className="diagonal-list">{diagonals.length ? diagonals.map(d => <div key={`${d.from}-${d.to}`}><span>Точка {d.from} → {d.to}</span><strong>{d.lengthMm} мм</strong></div>) : <span className="muted">Для этого контура диагоналей нет.</span>}</div>
      </aside>
    </div>
  </div>;
}
