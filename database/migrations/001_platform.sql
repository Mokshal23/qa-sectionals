create extension if not exists pgcrypto;

create table if not exists public.question_catalog (
  id text primary key,
  prompt text not null default '',
  prompt_html text not null default '',
  options jsonb not null default '[]'::jsonb,
  pillar text not null default '',
  topic text not null default '',
  area text not null default '',
  difficulty text not null check (difficulty in ('A','B','C')),
  response_type text not null check (response_type in ('MCQ','TITA')),
  p_value numeric,
  p_value_unit text not null default 'source-supplied',
  has_solution boolean not null default false,
  created_at timestamptz not null default now()
);

-- Answer keys are separated from the public question catalog. Clients never receive
-- this table; only narrowly scoped server routes using the service key can read it.
create table if not exists public.question_solutions (
  question_id text primary key references public.question_catalog(id) on delete cascade,
  answer text not null,
  solution text not null default '',
  solution_html text not null default ''
);

create table if not exists public.sectionals (
  id text primary key,
  title text not null,
  duration_seconds integer not null default 2400 check (duration_seconds > 0),
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sectional_questions (
  sectional_id text not null references public.sectionals(id) on delete cascade,
  question_id text not null references public.question_catalog(id),
  position integer not null check (position between 1 and 22),
  primary key (sectional_id, question_id),
  unique (sectional_id, position)
);

create table if not exists public.platform_invites (
  email text primary key,
  role text not null default 'participant' check (role in ('owner','participant')),
  active boolean not null default true,
  invite_token_hash text,
  invite_expires_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  sectional_id text not null references public.sectionals(id),
  status text not null default 'in_progress' check (status in ('in_progress','submitted')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb not null default '{}'::jsonb,
  retry_answers jsonb not null default '{}'::jsonb,
  mistake_labels jsonb not null default '{}'::jsonb,
  solution_opened jsonb not null default '[]'::jsonb,
  score jsonb,
  constraint submitted_state_consistent check ((status = 'submitted') = (submitted_at is not null))
);

create table if not exists public.attempt_events (
  id uuid primary key,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  question_id text,
  created_at timestamptz not null,
  duration_seconds numeric,
  active boolean,
  value jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists attempts_owner_started_idx on public.attempts(owner_id, started_at desc);
create index if not exists attempt_events_attempt_created_idx on public.attempt_events(attempt_id, created_at);

-- Start from no Data API access, then grant only the operations listed below.
revoke all on public.question_catalog, public.question_solutions,
  public.sectionals, public.sectional_questions, public.platform_invites,
  public.attempts, public.attempt_events from anon, authenticated;

alter table public.question_catalog enable row level security;
alter table public.question_solutions enable row level security;
alter table public.sectionals enable row level security;
alter table public.sectional_questions enable row level security;
alter table public.platform_invites enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_events enable row level security;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_invites i
    where i.email = lower(auth.jwt() ->> 'email') and i.active = true
  );
$$;
revoke all on function public.is_active_member() from public, anon;
grant execute on function public.is_active_member() to authenticated;

drop policy if exists "members can read stems in their sectionals" on public.question_catalog;
drop policy if exists "participants can read published sectionals" on public.sectionals;
drop policy if exists "participants can read published sectional items" on public.sectional_questions;
drop policy if exists "participants can read only their attempts" on public.attempts;
drop policy if exists "participants can create only their attempts" on public.attempts;
drop policy if exists "participants can update only their attempts" on public.attempts;
drop policy if exists "participants can read only their events" on public.attempt_events;
drop policy if exists "participants can create only their events" on public.attempt_events;

create policy "members can read stems in their sectionals"
  on public.question_catalog for select to authenticated using (
    public.is_active_member() and
    exists (
      select 1 from public.sectional_questions sq
      join public.sectionals s on s.id = sq.sectional_id
      join public.attempts a on a.sectional_id = s.id
      where sq.question_id = question_catalog.id and s.published = true and a.owner_id = auth.uid()
    )
  );
create policy "participants can read published sectionals"
  on public.sectionals for select to authenticated using (published = true and public.is_active_member());
create policy "participants can read published sectional items"
  on public.sectional_questions for select to authenticated
  using (public.is_active_member() and exists (select 1 from public.sectionals s where s.id = sectional_id and s.published = true));
create policy "participants can read only their attempts"
  on public.attempts for select to authenticated using (owner_id = auth.uid() and public.is_active_member());
create policy "participants can create only their attempts"
  on public.attempts for insert to authenticated with check (
    owner_id = auth.uid() and public.is_active_member() and exists (
      select 1 from public.sectionals s where s.id = sectional_id and s.published = true
    )
  );
create policy "participants can update only their attempts"
  on public.attempts for update to authenticated
  using (owner_id = auth.uid() and public.is_active_member()) with check (owner_id = auth.uid() and public.is_active_member());
create policy "participants can read only their events"
  on public.attempt_events for select to authenticated using (owner_id = auth.uid() and public.is_active_member());
create policy "participants can create only their events"
  on public.attempt_events for insert to authenticated with check (
    owner_id = auth.uid() and public.is_active_member() and exists (
      select 1 from public.attempts a where a.id = attempt_id and a.owner_id = auth.uid()
    )
  );

revoke all on public.question_solutions from anon, authenticated;
revoke all on public.platform_invites from anon, authenticated;
grant select on public.question_catalog to authenticated;
grant select on public.sectionals, public.sectional_questions to authenticated;
grant select, insert on public.attempts to authenticated;
revoke update on public.attempts from authenticated;
grant update (answers, retry_answers, mistake_labels, solution_opened) on public.attempts to authenticated;
grant select, insert on public.attempt_events to authenticated;

-- The service role is used by server routes for catalog management, invitations,
-- and scoring. No server route exposes organizer access to attempts.
