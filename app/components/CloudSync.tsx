'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CeilingProject, loadProjects, saveProjects } from '../../lib/project';
import { cloudConfigured, supabase } from '../../lib/supabase';

function mergeProjects(local: CeilingProject[], remote: CeilingProject[]) {
  const byId = new Map<string, CeilingProject>(local.map((project) => [project.id, project]));
  for (const project of remote) {
    const current = byId.get(project.id);
    if (!current || new Date(project.updatedAt).getTime() > new Date(current.updatedAt).getTime()) byId.set(project.id, project);
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function friendlyAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes('email_not_confirmed') || value.includes('email not confirmed')) return 'Подтвердите email по ссылке из письма Supabase, затем войдите снова.';
  if (value.includes('invalid login credentials')) return 'Неверный email или пароль. Если аккаунт новый — сначала подтвердите email.';
  if (value.includes('user already registered')) return 'Этот email уже зарегистрирован. Используйте вход.';
  if (value.includes('password')) return `Ошибка пароля: ${message}`;
  if (value.includes('failed to fetch') || value.includes('network')) return 'Нет связи с Supabase. Проверьте интернет и переменные Vercel.';
  if (value.includes('relation') && value.includes('projects')) return 'Таблица projects не создана. Выполните supabase/schema.sql в SQL Editor.';
  if (value.includes('row-level security') || value.includes('rls')) return 'Supabase отклонил запрос RLS. Проверьте авторизацию и политики таблицы projects.';
  return message;
}

export default function CloudSync() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  const sync = useCallback(async () => {
    if (!supabase) return;
    setBusy(true);
    setMessage('Синхронизация…');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      setMessage('Сначала войдите в аккаунт.');
      return;
    }

    const { data: rows, error } = await supabase.from('projects').select('project_id,payload').eq('user_id', user.id);
    if (error) {
      setBusy(false);
      setMessage(friendlyAuthError(error.message));
      return;
    }

    const remote = (rows ?? []).map((row) => row.payload as CeilingProject).filter((project) => project?.id && project?.name && Array.isArray(project.points));
    const merged = mergeProjects(loadProjects(), remote);
    const uploads = merged.map((project) => ({ user_id: user.id, project_id: project.id, name: project.name, updated_at: project.updatedAt, payload: project }));

    if (uploads.length) {
      const { error: uploadError } = await supabase.from('projects').upsert(uploads, { onConflict: 'user_id,project_id' });
      if (uploadError) {
        setBusy(false);
        setMessage(friendlyAuthError(uploadError.message));
        return;
      }
    }

    saveProjects(merged);
    setBusy(false);
    setMessage(`Синхронизировано: ${merged.length} проект(ов)`);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: authState } = supabase.auth.onAuthStateChange((event, session) => {
      const nextEmail = session?.user?.email ?? null;
      setUserEmail(nextEmail);
      if (event === 'SIGNED_IN') {
        setOpen(true);
        window.setTimeout(() => void sync(), 0);
      }
    });
    return () => authState.subscription.unsubscribe();
  }, [sync]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage('Вход…');
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) { setMessage(friendlyAuthError(result.error.message)); return; }
    setMessage('Вход выполнен.');
  }

  async function signup() {
    if (!supabase) return;
    if (!email.trim() || password.length < 6) {
      setMessage('Введите email и пароль минимум из 6 символов.');
      return;
    }
    setBusy(true); setMessage('Создание аккаунта…');
    const result = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (result.error) { setMessage(friendlyAuthError(result.error.message)); return; }
    if (result.data.session) setMessage('Аккаунт создан и вход выполнен.');
    else setMessage('Аккаунт создан. Откройте письмо и подтвердите email, затем войдите.');
  }

  async function resetPassword() {
    if (!supabase || !email.trim()) { setMessage('Сначала укажите email.'); return; }
    setBusy(true); setMessage('Отправка письма…');
    const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` });
    setBusy(false);
    setMessage(result.error ? friendlyAuthError(result.error.message) : 'Письмо для сброса пароля отправлено.');
  }

  async function logout() {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    setMessage(error ? friendlyAuthError(error.message) : 'Вы вышли из аккаунта.');
  }

  if (!cloudConfigured) return <div className="cloud-card"><strong>☁ Облако</strong><span>Supabase пока не настроен</span></div>;

  return <div className="cloud-card">
    <div className="cloud-head">
      <div><strong>☁ Облако</strong><span>{userEmail ?? 'Не выполнен вход'}</span></div>
      <button className="ghost" onClick={() => setOpen((value) => !value)}>{open ? 'Скрыть' : userEmail ? 'Управление' : 'Войти'}</button>
    </div>
    {open && <div className="cloud-body">
      {!userEmail ? <form onSubmit={login}>
        <input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input type="password" required minLength={6} autoComplete="current-password" placeholder="Пароль (минимум 6 символов)" value={password} onChange={(event) => setPassword(event.target.value)} />
        <div className="button-row"><button className="primary" disabled={busy} type="submit">Войти</button><button className="ghost" disabled={busy} type="button" onClick={() => void signup()}>Регистрация</button></div>
        <button className="ghost" disabled={busy} type="button" onClick={() => void resetPassword()} style={{ width: '100%', marginTop: 8 }}>Забыли пароль?</button>
      </form> : <>
        <button className="primary" disabled={busy} onClick={() => void sync()}>{busy ? 'Синхронизация…' : 'Синхронизировать проекты'}</button>
        <button className="ghost" disabled={busy} onClick={() => void logout()}>Выйти</button>
      </>}
      {message && <small className="cloud-message">{message}</small>}
    </div>}
  </div>;
}
