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

-- Google Drive image storage: holds the long-lived OAuth refresh token needed to mint fresh
-- Drive access tokens (those expire in ~1hr) without asking the user to reconnect every time.
-- The refresh token itself is only ever read by the refresh-drive-token Edge Function (service
-- role, bypasses RLS) — the client's own select policy below is scoped to auth.uid() = user_id
-- like every other table here, so it can technically read its own refresh_token back, but the
-- app only ever selects `updated_at` from it (settings screen "connected since" status).
create table if not exists user_drive_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists user_drive_tokens_set_updated_at on user_drive_tokens;
create trigger user_drive_tokens_set_updated_at
  before update on user_drive_tokens
  for each row execute function set_updated_at();

alter table user_drive_tokens enable row level security;

drop policy if exists "select own drive token" on user_drive_tokens;
create policy "select own drive token" on user_drive_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "insert own drive token" on user_drive_tokens;
create policy "insert own drive token" on user_drive_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own drive token" on user_drive_tokens;
create policy "update own drive token" on user_drive_tokens
  for update using (auth.uid() = user_id);

drop policy if exists "delete own drive token" on user_drive_tokens;
create policy "delete own drive token" on user_drive_tokens
  for delete using (auth.uid() = user_id);

-- read-only public sharing ("읽기모드 공유"): share_id is a stable random handle every note
-- already has, but it only grants anything once its owner flips share_enabled on. Knowing the
-- id is what grants read access, so it must never appear in any authenticated list/query
-- response beyond the owner's own rows — see get_shared_note below, not a broad RLS policy,
-- for how the public page actually reads it.
alter table notes add column if not exists share_id uuid not null default gen_random_uuid();
create unique index if not exists notes_share_id_idx on notes (share_id);
alter table notes add column if not exists share_enabled boolean not null default false;

-- the public share page (share.html) runs unauthenticated (anon key, no auth.uid()), so plain
-- RLS can't scope it to "this one note" — a `using (share_enabled = true)` policy would let
-- anyone list every publicly shared note across every user, not just the one whose id they
-- were given. A security definer function sidesteps RLS entirely but only ever returns the
-- single row matching the exact share_id passed in, and only the columns a read-only view
-- needs — never user_id or the row's other properties. Restricted to type='note' because only
-- plain markdown cards have a "읽기모드" to share; canvas/table cards aren't supported here.
create or replace function get_shared_note(p_share_id uuid)
returns table (title text, content text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select title, content, updated_at
  from notes
  where share_id = p_share_id and share_enabled = true and deleted_at is null and type = 'note'
$$;

revoke all on function get_shared_note(uuid) from public;
grant execute on function get_shared_note(uuid) to anon, authenticated;
