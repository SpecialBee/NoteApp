-- GRAPHIDEA note table
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

-- every query is implicitly filtered by the RLS policies above (user_id = auth.uid()), but
-- Postgres doesn't auto-index a plain FK column — without this, that filter is a sequential
-- scan of the whole table once there's more than one user's worth of rows in it. Matches the
-- app's actual hot-path query shape (loadAll: user_id + deleted_at is null, ordered by
-- updated_at desc) so it also satisfies the ORDER BY without a separate sort step. Must come
-- after the deleted_at column is added above, not before — this file is meant to run start to
-- finish on a brand-new Supabase project.
create index if not exists notes_user_id_deleted_at_updated_at_idx
  on notes (user_id, deleted_at, updated_at desc);

-- properties: ordered array of { id, name, type, value, options? }
alter table notes add column if not exists properties jsonb not null default '[]';

-- note "type" (note/canvas/table) as a real column instead of sniffing the content's fenced
-- code-block prefix client-side — lets the note list/graph/search load without pulling every
-- note's full content just to figure out which icon to show.
alter table notes add column if not exists type text not null default 'note';
update notes set type = case
  when content like '```canvas%' then 'canvas'
  when content like '```table%' then 'table'
  else 'note'
end;

-- cheap character count for the dashboard "총 글자 수" stat — computed by Postgres so the
-- client can sum it from the lightweight note list instead of loading every note's content.
alter table notes add column if not exists content_len integer generated always as (length(content)) stored;

-- enable realtime so open tabs/devices see each other's changes live
do $$
begin
  alter publication supabase_realtime add table notes;
exception
  when duplicate_object then null;
end $$;

-- dashboard "할 일" checklist widget (previously localStorage-only; now synced per user)
create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null default '',
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists checklist_items_user_id_created_at_idx
  on checklist_items (user_id, created_at desc);

alter table checklist_items enable row level security;

drop policy if exists "select own checklist items" on checklist_items;
create policy "select own checklist items" on checklist_items
  for select using (auth.uid() = user_id);

drop policy if exists "insert own checklist items" on checklist_items;
create policy "insert own checklist items" on checklist_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own checklist items" on checklist_items;
create policy "update own checklist items" on checklist_items
  for update using (auth.uid() = user_id);

drop policy if exists "delete own checklist items" on checklist_items;
create policy "delete own checklist items" on checklist_items
  for delete using (auth.uid() = user_id);
