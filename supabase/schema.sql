create table app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding jsonb not null default '{}'::jsonb,
  days jsonb not null default '{}'::jsonb,
  bank jsonb not null default '{"physical":[],"mental":[],"spiritual":[]}'::jsonb,
  checkins jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Migration for existing databases created before the "bank" column existed:
-- alter table app_data add column if not exists bank jsonb not null default '{"physical":[],"mental":[],"spiritual":[]}'::jsonb;

-- Migration for existing databases created before the "checkins" column existed
-- (weekly "which felt hardest?" reflection, keyed by that week's Monday date):
-- alter table app_data add column if not exists checkins jsonb not null default '{}'::jsonb;

alter table app_data enable row level security;

create policy "Users can read own data"
  on app_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on app_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on app_data for update
  using (auth.uid() = user_id);

create policy "Users can delete own data"
  on app_data for delete
  using (auth.uid() = user_id);

-- Minimal first-party product signal — no third-party analytics script, per
-- the project's dependency rule. Client only ever inserts; there's no select
-- policy because nothing in the app reads this back — query it directly via
-- the Supabase SQL Editor (which runs as an admin role and bypasses RLS).
create table if not exists events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table events enable row level security;

create policy "Users can insert own events"
  on events for insert
  with check (auth.uid() = user_id);

-- Merges `days` and `checkins` key-by-key (jsonb `||`) instead of blindly
-- overwriting the whole blob, so a stale device syncing can't silently wipe
-- out days that only exist on another device. `onboarding`/`bank` stay
-- last-write-wins (bank is deliberately not merged — see CLAUDE.md). Used
-- only for the additive logWin path; every action that can delete data
-- (clearDay/clearRange/resetPractice/restoreData/etc.) keeps using the plain
-- upsert below, since a `||` merge can never represent a deletion — a key
-- missing from the incoming payload just means "no new info," not "remove
-- this," so merging a delete would silently undo it.
--
-- No `security definer`: this intentionally runs as the calling user, so the
-- existing RLS insert/update policies on app_data (auth.uid() = user_id)
-- apply exactly as if the client had run the SQL directly — a caller can
-- never pass another user's p_user_id and have it take effect.
create or replace function merge_app_data(
  p_user_id uuid,
  p_onboarding jsonb,
  p_days jsonb,
  p_bank jsonb,
  p_checkins jsonb
) returns void
language plpgsql
as $$
begin
  insert into app_data (user_id, onboarding, days, bank, checkins, updated_at)
  values (p_user_id, p_onboarding, p_days, p_bank, p_checkins, now())
  on conflict (user_id) do update set
    onboarding = excluded.onboarding,
    days       = app_data.days || excluded.days,
    bank       = excluded.bank,
    checkins   = app_data.checkins || excluded.checkins,
    updated_at = now();
end;
$$;

grant execute on function merge_app_data(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
