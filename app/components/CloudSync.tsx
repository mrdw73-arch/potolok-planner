'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  clearDeletedClient,
  isClient,
  loadClients,
  loadDeletedClients,
  onClientsChanged,
  saveClients,
} from '../../lib/client';
import {
  clearDeletedProject,
  isCeilingProject,
  loadDeletedProjects,
  loadProjects,
  onProjectsChanged,
  saveProjects,
} from '../../lib/project';
import { cloudConfigured, supabase } from '../../lib/supabase';
import { syncTable } from '../../lib/sync';

const SYNC_DEBOUNCE_MS = 1500;

function friendlyAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes('email_not_confirmed') || value.includes('email not confirmed')) return 'Подтвердите email по ссылке из письма Supabase, затем войдите снова.';
  if (value.includes('invalid login credentials')) return 'Неверный email или пароль. Если аккаунт новый — сначала подтвердите email.';
  if (value.includes('user already registered')) return 'Этот email уже зарегистрирован. Используйте вход.';
  if (value.includes('password')) return `Ошибка пароля: ${message}`;
  if (value.includes('failed to fetch') || value.includes('network')) return 'Нет связи с Supabase. Проверьте интернет и переменные Vercel.';
  if (value.includes('relation') && value.includes('projects')) return 'Таблица projects не создана. Выполните supabase/schema.sql в SQL Editor.';
  if (value.includes('relation') && value.includes('clients')) return 'Таблица clients не создана. Выполните supabase/schema.sql в SQL Editor.';
  if (value.includes('row-level security') || value.includes('rls')) return 'Supabase отклонил запрос. Проверьте авторизацию и политики таблиц.';
  return message;
}

export default function CloudSync() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const syncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (!supabase || syncingRef.current) return;
    syncingRef.current = true;
    setBusy(true);
    setMessage('Синхронизация…');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMessage('Сначала войдите в аккаунт.');
        return;
      }

      const projectsResult = await syncTable(supabase, user.id, {
        table: 'projects',
        idColumn: 'project_id',
        loadLocal: loadProjects,
        saveLocal: saveProjects,
        loadTombstones: loadDeletedProjects,
        clearTombstone: clearDeletedProject,
        isValid: isCeilingProject,
      });
      if ('error' in projectsResult) {
        setMessage(friendlyAuthError(projectsResult.error));
        return;
      }

      const clientsResult = await syncTable(supabase, user.id, {
        table: 'clients',
        idColumn: 'client_id',
        loadLocal: loadClients,
        saveLocal: saveClients,
        loadTombstones: loadDeletedClients,
        clearTombstone: clearDeletedClient,
        isValid: isClient,
      });
      if ('error' in clientsResult) {
        setMessage(friendlyAuthError(clientsResult.error));
        return;
      }

      setMessage(`Синхронизировано: ${projectsResult.count} проект(ов), ${clientsResult.count} клиент(ов)`);
    } finally {
      syncingRef.current = false;
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUserEmail(data.user?.email ?? null);
      if (data.user) void sync();
    });
    const { data: authState } = supabase.auth.onAuthStateChange((event, session) => {
      const nextEmail = session?.user?.email ?? null;
      setUserEmail(nextEmail);
      if (event === 'SIGNED_IN') {
        setOpen(true);
        window.setTimeout(() => void sync(), 0);
      }
    });
    return () => {
      cancelled = true;
      authState.subscription.unsubscribe();
    };
  }, [sync]);

  useEffect(() => {
    if (!cloudConfigured) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSync = () => {
      if (!userEmail || syncingRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void sync(), SYNC_DEBOUNCE_MS);
    };
    const unsubscribeProjects = onProjectsChanged(scheduleSync);
    const unsubscribeClients = onClientsChanged(scheduleSync);
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribeProjects();
      unsubscribeClients();
    };
  }, [userEmail, sync]);

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
        <button className="primary" disabled={busy} onClick={() => void sync()}>{busy ? 'Синхронизация…' : 'Синхронизировать данные'}</button>
        <button className="ghost" disabled={busy} onClick={() => void logout()}>Выйти</button>
      </>}
      {message && <small className="cloud-message">{message}</small>}
    </div>}
  </div>;
}
