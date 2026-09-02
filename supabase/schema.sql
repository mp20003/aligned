create table app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding jsonb not null default '{}'::jsonb,
  days jsonb not null default '{}'::jsonb,
  bank jsonb not null default '{"physical":[],"mental":[],"spiritual":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Migration for existing databases created before the "bank" column existed:
-- alter table app_data add column if not exists bank jsonb not null default '{"physical":[],"mental":[],"spiritual":[]}'::jsonb;

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
