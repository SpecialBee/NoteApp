-- Stacker note table
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '제목 없음',
  content text not null default '',
  tags text[] not null default '{}',
  links text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- keep updated_at fresh automatically
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists notes_set_updated_at on notes;
create trigger notes_set_updated_at
  before update on notes
  for each row execute function set_updated_at();

-- lock the table down: each user can only touch their own rows
alter table notes enable row level security;

drop policy if exists "select own notes" on notes;
create policy "select own notes" on notes
  for select using (auth.uid() = user_id);

drop policy if exists "insert own notes" on notes;
create policy "insert own notes" on notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own notes" on notes;
create policy "update own notes" on notes
  for update using (auth.uid() = user_id);

drop policy if exists "delete own notes" on notes;
create policy "delete own notes" on notes
  for delete using (auth.uid() = user_id);

-- soft-delete support (trash / restore)
alter table notes add column if not exists deleted_at timestamptz;

-- properties: ordered array of { id, name, type, value, options? }
alter table notes add column if not exists properties jsonb not null default '[]';

-- canvas position for infinite-board view
alter table notes add column if not exists canvas_x float8;
alter table notes add column if not exists canvas_y float8;

-- canvas card accent color
alter table notes add column if not exists canvas_color text;

-- canvas section containers (labeled grouping boxes)
create table if not exists canvas_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null default '섹션',
  x float8 not null default 0,
  y float8 not null default 0,
  w float8 not null default 320,
  h float8 not null default 220,
  color text not null default '#82C4F8',
  created_at timestamptz not null default now()
);

alter table canvas_sections enable row level security;

drop policy if exists "select own sections" on canvas_sections;
create policy "select own sections" on canvas_sections
  for select using (auth.uid() = user_id);

drop policy if exists "insert own sections" on canvas_sections;
create policy "insert own sections" on canvas_sections
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own sections" on canvas_sections;
create policy "update own sections" on canvas_sections
  for update using (auth.uid() = user_id);

drop policy if exists "delete own sections" on canvas_sections;
create policy "delete own sections" on canvas_sections
  for delete using (auth.uid() = user_id);

-- enable realtime so open tabs/devices see each other's changes live
do $$
begin
  alter publication supabase_realtime add table notes;
exception
  when duplicate_object then null;
end $$;
