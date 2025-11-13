-- 100원 이벤트 할인 악보 테이블 및 뷰 생성 스크립트
-- 실행 전 public.drum_sheets 테이블과 uuid extension 이 존재해야 합니다.

create extension if not exists "uuid-ossp";

create table if not exists public.event_discount_sheets (
  id uuid primary key default uuid_generate_v4(),
  sheet_id uuid not null references public.drum_sheets(id) on delete cascade,
  original_price integer not null default 0,
  discount_price integer not null default 100,
  event_start timestamptz not null,
  event_end timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sheet_id)
);

create index if not exists event_discount_sheets_sheet_id_idx on public.event_discount_sheets(sheet_id);
create index if not exists event_discount_sheets_event_start_idx on public.event_discount_sheets(event_start);
create index if not exists event_discount_sheets_event_end_idx on public.event_discount_sheets(event_end);

create or replace function public.set_event_discount_original_price()
returns trigger as $$
declare
  sheet_price integer;
begin
  select price into sheet_price
  from public.drum_sheets
  where id = new.sheet_id;

  if sheet_price is null then
    raise exception '드럼 악보(%)의 가격 정보를 찾을 수 없습니다.', new.sheet_id;
  end if;

  if new.original_price is null or new.original_price <= 0 then
    new.original_price := sheet_price;
  end if;

  if new.discount_price is null or new.discount_price <= 0 then
    new.discount_price := 100;
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create or replace function public.touch_event_discount_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_event_discount_before_insert on public.event_discount_sheets;
create trigger trg_event_discount_before_insert
before insert on public.event_discount_sheets
for each row
execute function public.set_event_discount_original_price();

drop trigger if exists trg_event_discount_before_update on public.event_discount_sheets;
create trigger trg_event_discount_before_update
before update on public.event_discount_sheets
for each row
execute function public.touch_event_discount_updated_at();

create or replace view public.event_discount_sheet_view as
select
  eds.id,
  eds.sheet_id,
  eds.original_price,
  eds.discount_price,
  eds.event_start,
  eds.event_end,
  eds.is_active,
  eds.created_at,
  eds.updated_at,
  ds.title,
  ds.artist,
  ds.thumbnail_url,
  ds.category_id,
  ds.price as sheet_price,
  case
    when ds.price > 0 then round((1 - eds.discount_price::numeric / ds.price::numeric) * 100)
    else null
  end as discount_percent,
  case
    when not eds.is_active then 'disabled'
    when now() < eds.event_start then 'scheduled'
    when now() > eds.event_end then 'ended'
    else 'active'
  end as status
from public.event_discount_sheets eds
join public.drum_sheets ds on ds.id = eds.sheet_id;

alter table public.event_discount_sheets enable row level security;

drop policy if exists "event discount sheets select" on public.event_discount_sheets;
drop policy if exists "event discount sheets admin" on public.event_discount_sheets;

create policy "event discount sheets select" on public.event_discount_sheets
  for select using (true);

create policy "event discount sheets admin" on public.event_discount_sheets
  for all using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

