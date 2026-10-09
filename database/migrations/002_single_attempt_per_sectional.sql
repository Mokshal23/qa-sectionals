-- Reserve each participant/sectional pair once. This reservation table allows
-- us to enforce the rule even when older data already contains duplicate
-- attempts; existing attempt rows and reports are left untouched.
create table if not exists public.attempt_reservations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  sectional_id text not null references public.sectionals(id),
  reserved_at timestamptz not null default now(),
  primary key (owner_id, sectional_id)
);

alter table public.attempt_reservations enable row level security;
revoke all on public.attempt_reservations from anon, authenticated;
grant all privileges on public.attempt_reservations to service_role;

-- Backfill one reservation for each pair already present. Conflicting historic
-- attempts are preserved; the UI resumes an in-progress one or links to the
-- most recent completed one.
insert into public.attempt_reservations (owner_id, sectional_id)
select distinct owner_id, sectional_id
from public.attempts
on conflict (owner_id, sectional_id) do nothing;

create or replace function public.reserve_single_sectional_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.attempt_reservations (owner_id, sectional_id)
  values (new.owner_id, new.sectional_id)
  on conflict (owner_id, sectional_id) do nothing;

  if not found then
    raise exception 'A participant can only attempt a sectional once.'
      using errcode = '23505', constraint = 'attempts_one_per_participant_sectional';
  end if;

  return new;
end;
$$;

revoke all on function public.reserve_single_sectional_attempt() from public, anon, authenticated;

drop trigger if exists attempts_reserve_single_sectional on public.attempts;
create trigger attempts_reserve_single_sectional
before insert on public.attempts
for each row execute function public.reserve_single_sectional_attempt();
