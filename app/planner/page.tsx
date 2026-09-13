'use client';

import { useMemo, useState } from 'react';
import './planner.css';

type Mode = 'select' | 'room' | 'lights' | 'price';
type Room = { width: number; height: number };
type History = { room: Room; mode: Mode; grid: number };

const initialRoom: Room = { width: 5000, height: 3600 };

export default function PlannerWorkspace() {
  const [room, setRoom] = useState<Room>(initialRoom);
  const [mode, setMode] = useState<Mode>('select');
  const [projectName, setProjectName] = useState('Новая комната');
  const [saved, setSaved] = useState(false);
  const [grid, setGrid] = useState(100);
  const [history, setHistory] = useState<History[]>([]);
  const [future, setFuture] = useState<History[]>([]);
  const [showDiagonals, setShowDiagonals] = useState(true);

  const area = useMemo(() => (room.width * room.height) / 1_000_000, [room]);
  const perimeter = useMemo(() => (2 * (room.width + room.height)) / 1000, [room]);
  const canvas = Math.ceil(area * 1.05 * 10) / 10;

  const snapshot = (): History => ({ room, mode, grid });
  const apply = (next: History) => {
    setRoom(next.room);
    setMode(next.mode);
    setGrid(next.grid);
    setSaved(false);
  };
  const commit = (nextRoom: Room) => {
    setHistory((items) => [...items.slice(-49), snapshot()]);
    setFuture([]);
    setRoom(nextRoom);
    setSaved(false);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [...items.slice(-49), snapshot()]);
    setHistory((items) => items.slice(0, -1));
    apply(previous);
  };
  const redo = () => {
    const next = future.at(-1);
    if (!next) return;
    setHistory((items) => [...items.slice(-49), snapshot()]);
    setFuture((items) => items.slice(0, -1));
    apply(next);
  };

  const update = (key: keyof Room, value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 1000 && parsed <= 30000 && parsed !== room[key]) {
      commit({ ...room, [key]: parsed });
    }
  };

  const setTool = (next: Mode) => {
    setHistory((items) => [...items.slice(-49), snapshot()]);
    setFuture([]);
    setMode(next);
    setSaved(false);
  };

  const changeGrid = (value: number) => {
    setHistory((items) => [...items.slice(-49), snapshot()]);
    setFuture([]);
    setGrid(value);
    setSaved(false);
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
          <button onClick={undo} disabled={!history.length} title="Ctrl+Z">↶ Отмена</button>
          <button onClick={redo} disabled={!future.length} title="Ctrl+Y">↷ Повтор</button>
          <button onClick={() => setSaved(true)}>{saved ? 'Сохранено ✓' : 'Сохранить'}</button>
          <button className="primary" onClick={() => window.print()}>Печать / PDF</button>
        </div>
      </header>

      <section className="planner-toolbar">
        <button className={mode === 'select' ? 'active' : ''} onClick={() => setTool('select')}>↖ Выбор</button>
        <button className={mode === 'room' ? 'active' : ''} onClick={() => setTool('room')}>▱ Геометрия</button>
        <button className={mode === 'lights' ? 'active' : ''} onClick={() => setTool('lights')}>✦ Освещение</button>
        <button className={mode === 'price' ? 'active' : ''} onClick={() => setTool('price')}>₽ Расчёт</button>
        <span className="toolbar-divider" />
        <button onClick={() => setShowDiagonals((v) => !v)}>{showDiagonals ? '⌁ Диагонали' : '⌁ Диагонали выкл.'}</button>
        <span className="grid-control">Сетка <select value={grid} onChange={(e) => changeGrid(Number(e.target.value))}><option value={10}>10 мм</option><option value={50}>50 мм</option><option value={100}>100 мм</option></select></span>
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
          <button className="element-btn" onClick={() => setTool('lights')}>＋ Точечный светильник</button>
          <button className="element-btn" onClick={() => setTool('lights')}>＋ Люстра</button>
          <button className="element-btn" onClick={() => setTool('lights')}>＋ Карниз</button>
          <div className="hint">Выберите инструмент сверху. История изменений хранит последние 50 действий.</div>
        </aside>

        <section className="canvas-panel">
          <div className="canvas-head"><span>План помещения</span><span className="scale">Инструмент: {mode === 'select' ? 'Выбор' : mode === 'room' ? 'Геометрия' : mode === 'lights' ? 'Освещение' : 'Расчёт'}</span></div>
          <div className="drawing-area">
            <div className="room-drawing" style={{ aspectRatio: `${room.width} / ${room.height}`, backgroundSize: `${Math.max(8, Math.min(32, grid / 4))}px ${Math.max(8, Math.min(32, grid / 4))}px` }}>
              <div className="room-fill">
                <span>{room.width} мм</span>
                <strong>{area.toFixed(2)} м²</strong>
                <span>{room.height} мм</span>
                {showDiagonals && <small>Диагональ: {Math.round(Math.hypot(room.width, room.height))} мм</small>}
              </div>
            </div>
          </div>
          <div className="canvas-footer"><span>● Привязка к сетке {grid} мм</span><span>История: {history.length} · {future.length}</span></div>
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
