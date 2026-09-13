'use client';

import { useMemo, useState } from 'react';
import './planner.css';

type Mode = 'room' | 'lights' | 'price';

const initialRoom = { width: 5000, height: 3600 };

export default function PlannerWorkspace() {
  const [room, setRoom] = useState(initialRoom);
  const [mode, setMode] = useState<Mode>('room');
  const [projectName, setProjectName] = useState('Новая комната');
  const [saved, setSaved] = useState(false);

  const area = useMemo(() => (room.width * room.height) / 1_000_000, [room]);
  const perimeter = useMemo(() => (2 * (room.width + room.height)) / 1000, [room]);
  const canvas = Math.ceil(area * 1.05 * 10) / 10;

  const update = (key: 'width' | 'height', value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 1000 && parsed <= 30000) {
      setRoom((current) => ({ ...current, [key]: parsed }));
      setSaved(false);
    }
  };

  return (
    <main className="planner-page">
      <header className="planner-header">
        <div className="planner-brand">
          <div className="planner-logo">P</div>
          <div><strong>Potolok Planner</strong><span>Планировщик натяжных потолков</span></div>
        </div>
        <div className="planner-project">
          <label>Проект</label>
          <input value={projectName} onChange={(e) => { setProjectName(e.target.value); setSaved(false); }} />
        </div>
        <div className="planner-actions">
          <button onClick={() => setSaved(true)}>{saved ? 'Сохранено ✓' : 'Сохранить'}</button>
          <button className="primary" onClick={() => window.print()}>Печать / PDF</button>
        </div>
      </header>

      <section className="planner-toolbar">
        <button className={mode === 'room' ? 'active' : ''} onClick={() => setMode('room')}>▱ Геометрия</button>
        <button className={mode === 'lights' ? 'active' : ''} onClick={() => setMode('lights')}>✦ Освещение</button>
        <button className={mode === 'price' ? 'active' : ''} onClick={() => setMode('price')}>₽ Расчёт</button>
      </section>

      <div className="planner-grid">
        <aside className="planner-sidebar">
          <div className="panel-title">Параметры помещения</div>
          <div className="field-row"><label>Ширина, мм</label><input type="number" value={room.width} onChange={(e) => update('width', e.target.value)} /></div>
          <div className="field-row"><label>Длина, мм</label><input type="number" value={room.height} onChange={(e) => update('height', e.target.value)} /></div>
          <div className="metric-grid">
            <div><span>Площадь</span><b>{area.toFixed(2)} м²</b></div>
            <div><span>Периметр</span><b>{perimeter.toFixed(2)} м</b></div>
          </div>
          <div className="panel-divider" />
          <div className="panel-title">Элементы</div>
          <button className="element-btn">＋ Точечный светильник</button>
          <button className="element-btn">＋ Люстра</button>
          <button className="element-btn">＋ Карниз</button>
          <div className="hint">Следующим этапом элементы станут интерактивными и будут участвовать в смете.</div>
        </aside>

        <section className="canvas-panel">
          <div className="canvas-head"><span>План помещения</span><span className="scale">Масштаб: авто</span></div>
          <div className="drawing-area">
            <div className="room-drawing" style={{ aspectRatio: `${room.width} / ${room.height}` }}>
              <div className="room-fill">
                <span>{room.width} мм</span>
                <strong>{area.toFixed(2)} м²</strong>
                <span>{room.height} мм</span>
              </div>
            </div>
          </div>
          <div className="canvas-footer"><span>● Привязка к углам включена</span><span>Сетка 100 мм</span></div>
        </section>

        <aside className="estimate-panel">
          <div className="panel-title">Предварительный расчёт</div>
          <div className="estimate-line"><span>Полотно</span><b>{canvas.toFixed(1)} м²</b></div>
          <div className="estimate-line"><span>Профиль</span><b>{perimeter.toFixed(1)} м</b></div>
          <div className="estimate-line"><span>Вставка</span><b>{perimeter.toFixed(1)} м</b></div>
          <div className="estimate-line"><span>Монтаж</span><b>{area.toFixed(1)} м²</b></div>
          <div className="estimate-total"><span>Итого ориентировочно</span><strong>{Math.round(area * 900 + perimeter * 350 + area * 500).toLocaleString('ru-RU')} ₽</strong></div>
          <button className="primary full">Открыть подробную смету →</button>
          <div className="estimate-note">Расчёт предварительный. Цены и коэффициенты можно настроить в каталоге.</div>
        </aside>
      </div>
    </main>
  );
}
