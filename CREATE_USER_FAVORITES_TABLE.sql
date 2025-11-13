create table if not exists public.user_favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sheet_id uuid not null references public.drum_sheets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, sheet_id)
);

create index if not exists idx_user_favorites_user on public.user_favorites(user_id);
create index if not exists idx_user_favorites_sheet on public.user_favorites(sheet_id);

alter table public.user_favorites enable row level security;

drop policy if exists "user_favorites_select" on public.user_favorites;
create policy "user_favorites_select" on public.user_favorites
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_favorites_insert" on public.user_favorites;
create policy "user_favorites_insert" on public.user_favorites
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_favorites_delete" on public.user_favorites;
create policy "user_favorites_delete" on public.user_favorites
  for delete
  using (auth.uid() = user_id);



