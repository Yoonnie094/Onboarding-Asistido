-- CER Analytics foundation: identity profiles, farms and farm memberships.
-- Membership roles are stored as labels only; this migration does not define role privileges.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.farm_memberships (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (length(btrim(role)) > 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  constraint farm_memberships_farm_user_key unique (farm_id, user_id)
);

create index farm_memberships_user_status_idx
  on public.farm_memberships (user_id, status);

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.farm_memberships enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.farms from anon, authenticated;
revoke all on table public.farm_memberships from anon, authenticated;

grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.farms to authenticated;
grant select on table public.farm_memberships to authenticated;

create policy "profiles_select_self"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "farm_memberships_select_self"
  on public.farm_memberships
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "farms_select_for_active_members"
  on public.farms
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.farm_memberships as membership
      where membership.farm_id = farms.id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

-- Create the profile row on signup without granting clients direct insert privileges.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
