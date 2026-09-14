'use client';

import { useState } from 'react';
import { Client, createClientId } from '../../lib/client';

type Props = {
  clients: Client[];
  projectCounts: Record<string, number>;
  onSave: (client: Client) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

type FormState = { name: string; phone: string; address: string; notes: string };
const emptyForm: FormState = { name: '', phone: '', address: '', notes: '' };

export default function ClientsPanel({ clients, projectCounts, onSave, onDelete, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  function startNew() {
    setEditingId('new');
    setForm(emptyForm);
  }
  function startEdit(client: Client) {
    setEditingId(client.id);
    setForm({ name: client.name, phone: client.phone, address: client.address, notes: client.notes });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }
  function save() {
    if (!form.name.trim()) return;
    const isNew = editingId === 'new' || !editingId;
    const existing = !isNew ? clients.find((client) => client.id === editingId) : undefined;
    onSave({
      id: existing?.id ?? createClientId(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      notes: form.notes,
      updatedAt: new Date().toISOString(),
    });
    cancelEdit();
  }

  return <section className="panel" style={{ margin: '12px 16px', padding: 16 }}>
    <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>Клиенты</span>
      <div className="button-row">
        {editingId === null && <button className="ghost" onClick={startNew}>＋ Клиент</button>}
        <button className="ghost" onClick={onClose}>Закрыть</button>
      </div>
    </div>
    {editingId !== null && <div className="cloud-body" style={{ marginTop: 8 }}>
      <input placeholder="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <input placeholder="Адрес" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      <textarea placeholder="Заметки" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <div className="button-row">
        <button className="primary" disabled={!form.name.trim()} onClick={save}>Сохранить</button>
        <button className="ghost" onClick={cancelEdit}>Отмена</button>
      </div>
    </div>}
    <div style={{ marginTop: 8 }}>
      {clients.length === 0 ? <div className="muted">Пока нет сохранённых клиентов.</div> : clients.map((client) => <div key={client.id} className="stat">
        <div>
          <button className="ghost" onClick={() => startEdit(client)}>{client.name}</button>
          <span className="muted" style={{ marginLeft: 8 }}>{client.phone}{client.address ? ` · ${client.address}` : ''}</span>
        </div>
        <span className="muted">{projectCounts[client.id] ?? 0} проект(ов)</span>
        <button className="delete-feature" onClick={() => onDelete(client.id)}>Удалить</button>
      </div>)}
    </div>
  </section>;
}
