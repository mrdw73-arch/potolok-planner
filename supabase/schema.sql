create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  name text not null,
  updated_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id, project_id)
);

alter table public.projects enable row level security;

drop policy if exists "Users can view own projects" on public.projects;
create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own projects" on public.projects;
create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

create index if not exists projects_user_updated_idx
  on public.projects(user_id, updated_at desc);
