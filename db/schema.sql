-- Minimum schema for the MVP (SPEC.md). Supabase Postgres. Row-level security to be added before any real athlete data.

create table coach (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table athlete (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coach(id) on delete cascade,
  name text not null,
  join_code text unique not null,
  consented_at timestamptz,
  injury_flags jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table program (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coach(id) on delete cascade,
  athlete_id uuid references athlete(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table session (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references program(id) on delete cascade,
  scheduled_on date not null,
  label text not null,
  week_type text not null default 'normal' check (week_type in ('normal', 'deload'))
);

create table exercise_prescription (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references session(id) on delete cascade,
  position int not null,
  name text not null,
  sets int not null,
  reps int not null,
  load text not null,
  target_rpe numeric(3,1),
  coach_cleared_injury boolean not null default false
);

create table checkin (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athlete(id) on delete cascade,
  on_date date not null,
  session_rpe numeric(3,1),
  sleep_h numeric(3,1),
  soreness jsonb not null default '{}',
  stress int check (stress between 0 and 10),
  note text,
  unique (athlete_id, on_date)
);

-- Wearable rows arrive here later. Kept now so the agent input contract does not change.
create table readiness_signal (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athlete(id) on delete cascade,
  on_date date not null,
  type text not null,
  value numeric not null,
  source text not null
);

create table proposal (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athlete(id) on delete cascade,
  session_id uuid not null references session(id) on delete cascade,
  edits jsonb not null,
  reason text not null,
  rules_applied text[] not null default '{}',
  inputs_snapshot jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'edited', 'rejected')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
