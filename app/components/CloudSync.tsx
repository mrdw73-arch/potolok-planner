'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CeilingProject, loadProjects, saveProjects } from '../../lib/project';
import { cloudConfigured, supabase } from '../../lib/supabase';

export default function CloudSync() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function auth(action: 'login' | 'signup') {
    if (!supabase) return;
    setBusy(true); setMessage('');
    const result = action === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else setMessage(action === 'signup' ? 'Аккаунт создан. Проверьте почту, если включено подтверждение.' : 'Вход выполнен');
  }

  async function sync() {
    if (!supabase) return;
    setBusy(true); setMessage('Синхронизация…');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setMessage('Сначала войдите'); return; }
    const local = loadProjects();
    const { data: remote, error } = await supabase.from('projects').select('project_id,payload').eq('user_id', user.id);
    if (error) { setBusy(false); setMessage(error.message); return; }
    const byId = new Map<string, CeilingProject>(local.map(p => [p.id, p]));
    for (const row of remote ?? []) {
      const project = row.payload as CeilingProject;
      if (project?.id && (!byId.has(project.id) || new Date(project.updatedAt).getTime() > new Date(byId.get(project.id)!.updatedAt).getTime())) byId.set(project.id, project);
    }
    const merged = Array.from(byId.values()).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const uploads = merged.map(project => ({ user_id: user.id, project_id: project.id, name: project.name, updated_at: project.updatedAt, payload: project }));
    const { error: uploadError } = uploads.length ? await supabase.from('projects').upsert(uploads, { onConflict: 'user_id,project_id' }) : { error: null };
    if (uploadError) { setBusy(false); setMessage(uploadError.message); return; }
    saveProjects(merged);
    setBusy(false); setMessage(`Синхронизировано: ${merged.length} проект(ов)`);
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setMessage('Вы вышли из аккаунта');
  }

  if (!cloudConfigured) return <div className="cloud-card"><strong>☁ Облако</strong><span>Supabase пока не настроен</span></div>;

  return <div className="cloud-card">
    <div className="cloud-head"><div><strong>☁ Облако</strong><span>{userEmail ? userEmail : 'Не выполнен вход'}</span></div><button className="ghost" onClick={() => setOpen(v => !v)}>{open ? 'Скрыть' : userEmail ? 'Управление' : 'Войти'}</button></div>
    {open && <div className="cloud-body">
      {!userEmail ? <>
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="Пароль" value={password} onChange={e=>setPassword(e.target.value)} />
        <div className="button-row"><button className="primary" disabled={busy} onClick={()=>auth('login')}>Войти</button><button className="ghost" disabled={busy} onClick={()=>auth('signup')}>Регистрация</button></div>
      </> : <>
        <button className="primary" disabled={busy} onClick={sync}>{busy ? 'Синхронизация…' : 'Синхронизировать проекты'}</button>
        <button className="ghost" disabled={busy} onClick={logout}>Выйти</button>
      </>}
      {message && <small className="cloud-message">{message}</small>}
    </div>}
  </div>;
}
