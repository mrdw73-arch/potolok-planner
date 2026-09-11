'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CeilingProject, loadProjects, saveProjects } from '../../lib/project';
import { cloudConfigured, supabase } from '../../lib/supabase';

function mergeProjects(local: CeilingProject[], remote: CeilingProject[]) {
  const byId = new Map<string, CeilingProject>(local.map((project) => [project.id, project]));

  for (const project of remote) {
    const current = byId.get(project.id);
    if (!current || new Date(project.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
      byId.set(project.id, project);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
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
      setMessage('Сначала войдите');
      return;
    }

    const { data: rows, error } = await supabase
      .from('projects')
      .select('project_id,payload')
      .eq('user_id', user.id);

    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }

    const remote = (rows ?? [])
      .map((row) => row.payload as CeilingProject)
      .filter((project) => project?.id && project?.name && Array.isArray(project.points));

    const merged = mergeProjects(loadProjects(), remote);
    const uploads = merged.map((project) => ({
      user_id: user.id,
      project_id: project.id,
      name: project.name,
      updated_at: project.updatedAt,
      payload: project,
    }));

    if (uploads.length) {
      const { error: uploadError } = await supabase
        .from('projects')
        .upsert(uploads, { onConflict: 'user_id,project_id' });

      if (uploadError) {
        setBusy(false);
        setMessage(uploadError.message);
        return;
      }
    }

    saveProjects(merged);
    setBusy(false);
    setMessage(`Синхронизировано: ${merged.length} проект(ов)`);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    const { data: authState } = supabase.auth.onAuthStateChange((event, session) => {
      const nextEmail = session?.user?.email ?? null;
      setUserEmail(nextEmail);

      if (event === 'SIGNED_IN') {
        setOpen(true);
        void sync();
      }
    });

    return () => authState.subscription.unsubscribe();
  }, [sync]);

  async function auth(event: FormEvent<HTMLFormElement>, action: 'login' | 'signup') {
    event.preventDefault();
    if (!supabase) return;

    setBusy(true);
    setMessage('');

    const result = action === 'login'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });

    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage(
      action === 'signup'
        ? 'Аккаунт создан. Проверьте почту, если подтверждение включено.'
        : 'Вход выполнен',
    );
  }

  async function logout() {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    setMessage(error ? error.message : 'Вы вышли из аккаунта');
  }

  if (!cloudConfigured) {
    return (
      <div className="cloud-card">
        <strong>☁ Облако</strong>
        <span>Supabase пока не настроен</span>
      </div>
    );
  }

  return (
    <div className="cloud-card">
      <div className="cloud-head">
        <div>
          <strong>☁ Облако</strong>
          <span>{userEmail ?? 'Не выполнен вход'}</span>
        </div>
        <button className="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? 'Скрыть' : userEmail ? 'Управление' : 'Войти'}
        </button>
      </div>

      {open && (
        <div className="cloud-body">
          {!userEmail ? (
            <>
              <form onSubmit={(event) => void auth(event, 'login')}>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  placeholder="Пароль (минимум 6 символов)"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <div className="button-row">
                  <button className="primary" disabled={busy} type="submit">Войти</button>
                  <button
                    className="ghost"
                    disabled={busy}
                    type="button"
                    onClick={() => {
                      void (async () => {
                        if (!supabase) return;
                        setBusy(true);
                        setMessage('');
                        const result = await supabase.auth.signUp({
                          email: email.trim(),
                          password,
                        });
                        setBusy(false);
                        setMessage(
                          result.error
                            ? result.error.message
                            : 'Аккаунт создан. Проверьте почту, если подтверждение включено.',
                        );
                      })();
                    }}
                  >
                    Регистрация
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <button className="primary" disabled={busy} onClick={() => void sync()}>
                {busy ? 'Синхронизация…' : 'Синхронизировать проекты'}
              </button>
              <button className="ghost" disabled={busy} onClick={() => void logout()}>
                Выйти
              </button>
            </>
          )}
          {message && <small className="cloud-message">{message}</small>}
        </div>
      )}
    </div>
  );
}
