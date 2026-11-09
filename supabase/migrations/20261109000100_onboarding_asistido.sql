-- CER Analytics · Onboarding asistido (demo de clase).
-- Agrega: perfil extendido, contexto del fundo, cuarteles, importaciones, equipo/invitaciones,
-- asignaciones de cuarteles, sesiones y eventos de onboarding, y RPCs para completar el flujo.
-- Requiere 20261106000100_foundation.sql aplicada antes.

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create or replace function public.try_numeric(p_value text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return replace(btrim(p_value), ',', '.')::numeric;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfil extendido
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists job_title text,
  add column if not exists phone text,
  add column if not exists user_role text;

grant update (full_name, job_title, phone, user_role, updated_at) on table public.profiles to authenticated;

create policy "profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Fundo: ubicación y perfil de contexto
-- ---------------------------------------------------------------------------

alter table public.farms
  add column if not exists region text,
  add column if not exists commune text,
  add column if not exists context jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Helpers de membresía (security definer para evitar recursión en RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_farm_member(p_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.farm_memberships m
    where m.farm_id = p_farm_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

revoke all on function public.is_farm_member(uuid) from public, anon;
grant execute on function public.is_farm_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Cuarteles
-- ---------------------------------------------------------------------------

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  code text not null check (length(btrim(code)) > 0),
  name text,
  species text,
  variety text,
  rootstock text,
  planting_year smallint,
  density numeric,
  area_ha numeric,
  irrigation text,
  geometry jsonb,
  source text not null default 'planilla',
  created_at timestamptz not null default now(),
  constraint blocks_farm_code_key unique (farm_id, code)
);

create index blocks_farm_idx on public.blocks (farm_id);

-- ---------------------------------------------------------------------------
-- Resumen de importaciones (cartografía y planilla)
-- ---------------------------------------------------------------------------

create table public.farm_imports (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  source_type text not null check (source_type in ('cartografia', 'planilla')),
  file_name text,
  row_count integer not null default 0,
  valid_count integer not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  quality_score numeric,
  mapping jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index farm_imports_farm_idx on public.farm_imports (farm_id);

-- ---------------------------------------------------------------------------
-- Equipo: invitaciones y asignación de cuarteles
-- ---------------------------------------------------------------------------

create table public.farm_invitations (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  full_name text,
  role text not null default 'muestreador'
    check (role in ('administrador', 'agronomo', 'muestreador')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references public.profiles (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index farm_invitations_farm_email_key
  on public.farm_invitations (farm_id, lower(email));

create table public.block_assignments (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  block_id uuid not null references public.blocks (id) on delete cascade,
  invitation_id uuid references public.farm_invitations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint block_assignments_block_invitation_key unique (block_id, invitation_id)
);

create index block_assignments_user_idx on public.block_assignments (user_id);

-- ---------------------------------------------------------------------------
-- Sesiones y eventos de onboarding
-- ---------------------------------------------------------------------------

create table public.onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed')),
  current_step text not null default 'perfil',
  data jsonb not null default '{}'::jsonb,
  farm_id uuid references public.farms (id) on delete set null,
  rating smallint check (rating between 1 and 5),
  feedback text,
  -- Encuesta de diagnóstico de madurez digital (forma DiagnosticResult en src/lib/onboarding/diagnostic.ts).
  diagnostic jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer
);

create unique index onboarding_sessions_one_in_progress
  on public.onboarding_sessions (user_id)
  where status = 'in_progress';

create table public.onboarding_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.onboarding_sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  step text not null,
  event text not null
    check (event in ('step_view', 'step_complete', 'step_skip', 'completed', 'resumed', 'micro_survey')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index onboarding_events_session_idx on public.onboarding_events (session_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.blocks enable row level security;
alter table public.farm_imports enable row level security;
alter table public.farm_invitations enable row level security;
alter table public.block_assignments enable row level security;
alter table public.onboarding_sessions enable row level security;
alter table public.onboarding_events enable row level security;

revoke all on table public.blocks from anon, authenticated;
revoke all on table public.farm_imports from anon, authenticated;
revoke all on table public.farm_invitations from anon, authenticated;
revoke all on table public.block_assignments from anon, authenticated;
revoke all on table public.onboarding_sessions from anon, authenticated;
revoke all on table public.onboarding_events from anon, authenticated;

grant select on table public.blocks to authenticated;
grant select on table public.farm_imports to authenticated;
grant select on table public.farm_invitations to authenticated;
grant select on table public.block_assignments to authenticated;
grant select, insert, delete on table public.onboarding_sessions to authenticated;
grant update (current_step, data, rating, feedback, updated_at) on table public.onboarding_sessions to authenticated;
grant select, insert on table public.onboarding_events to authenticated;

create policy "blocks_select_members"
  on public.blocks for select to authenticated
  using (public.is_farm_member(farm_id));

create policy "farm_imports_select_members"
  on public.farm_imports for select to authenticated
  using (public.is_farm_member(farm_id));

create policy "farm_invitations_select_members"
  on public.farm_invitations for select to authenticated
  using (public.is_farm_member(farm_id));

create policy "block_assignments_select_members"
  on public.block_assignments for select to authenticated
  using (public.is_farm_member(farm_id));

create policy "onboarding_sessions_select_own"
  on public.onboarding_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "onboarding_sessions_insert_own"
  on public.onboarding_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'in_progress');

create policy "onboarding_sessions_update_own_in_progress"
  on public.onboarding_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "onboarding_sessions_delete_own_in_progress"
  on public.onboarding_sessions for delete to authenticated
  using ((select auth.uid()) = user_id and status = 'in_progress');

create policy "onboarding_events_select_own"
  on public.onboarding_events for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "onboarding_events_insert_own"
  on public.onboarding_events for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.onboarding_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Alta de usuario: perfil + aceptar invitaciones pendientes por email
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation record;
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  for v_invitation in
    select i.*
    from public.farm_invitations i
    where lower(i.email) = lower(new.email)
      and i.status = 'pending'
  loop
    insert into public.farm_memberships (farm_id, user_id, role, status)
    values (v_invitation.farm_id, new.id, v_invitation.role, 'active')
    on conflict (farm_id, user_id) do nothing;

    update public.farm_invitations
    set status = 'accepted', user_id = new.id, accepted_at = now()
    where id = v_invitation.id;

    update public.block_assignments
    set user_id = new.id
    where invitation_id = v_invitation.id;

    if v_invitation.full_name is not null then
      update public.profiles
      set full_name = coalesce(full_name, v_invitation.full_name)
      where id = new.id;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: completar el onboarding (crea fundo, cuarteles, importaciones y equipo)
-- Lee onboarding_sessions.data con la forma OnboardingDraft (src/lib/onboarding/types.ts).
-- ---------------------------------------------------------------------------

create or replace function public.complete_onboarding(p_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.onboarding_sessions%rowtype;
  v_data jsonb;
  v_farm_id uuid;
  v_block jsonb;
  v_member jsonb;
  v_invitation_id uuid;
  v_existing_user uuid;
  v_code text;
  v_role text;
  v_block_id uuid;
  v_quality jsonb;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  select * into v_session
  from public.onboarding_sessions
  where id = p_session_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'Sesión de onboarding no encontrada';
  end if;

  if v_session.status = 'completed' then
    return v_session.farm_id;
  end if;

  v_data := coalesce(v_session.data, '{}'::jsonb);

  if coalesce(btrim(v_data #>> '{farm,name}'), '') = '' then
    raise exception 'Falta el nombre del fundo';
  end if;

  -- Perfil
  update public.profiles
  set full_name = nullif(btrim(v_data #>> '{profile,fullName}'), ''),
      job_title = nullif(btrim(v_data #>> '{profile,jobTitle}'), ''),
      phone = nullif(btrim(v_data #>> '{profile,phone}'), ''),
      user_role = nullif(btrim(v_data #>> '{profile,userRole}'), ''),
      updated_at = now()
  where id = v_uid;

  -- Fundo + perfil de contexto
  insert into public.farms (name, created_by, region, commune, context)
  values (
    btrim(v_data #>> '{farm,name}'),
    v_uid,
    nullif(v_data #>> '{farm,region}', ''),
    nullif(btrim(v_data #>> '{farm,commune}'), ''),
    jsonb_build_object(
      'operation', coalesce(v_data -> 'operation', '{}'::jsonb),
      'profileRole', v_data #>> '{profile,userRole}',
      'createdFromSession', p_session_id
    )
  )
  returning id into v_farm_id;

  v_role := case
    when v_data #>> '{profile,userRole}' = 'agronomo' then 'agronomo'
    else 'administrador'
  end;

  insert into public.farm_memberships (farm_id, user_id, role, status)
  values (v_farm_id, v_uid, v_role, 'active');

  -- Cuarteles
  for v_block in select * from jsonb_array_elements(coalesce(v_data -> 'blocks', '[]'::jsonb))
  loop
    v_code := nullif(btrim(v_block ->> 'code'), '');
    continue when v_code is null;

    insert into public.blocks (
      farm_id, code, name, species, variety, rootstock, planting_year,
      density, area_ha, irrigation, geometry, source
    )
    values (
      v_farm_id,
      v_code,
      nullif(btrim(v_block ->> 'name'), ''),
      nullif(btrim(v_block ->> 'species'), ''),
      nullif(btrim(v_block ->> 'variety'), ''),
      nullif(btrim(v_block ->> 'rootstock'), ''),
      public.try_numeric(v_block ->> 'plantingYear')::smallint,
      public.try_numeric(v_block ->> 'density'),
      public.try_numeric(v_block ->> 'areaHa'),
      nullif(btrim(v_block ->> 'irrigation'), ''),
      case when jsonb_typeof(v_block -> 'geometry') = 'object' then v_block -> 'geometry' else null end,
      coalesce(nullif(v_block ->> 'source', ''), 'planilla')
    )
    on conflict (farm_id, code) do nothing;
  end loop;

  -- Resumen de importaciones
  if jsonb_typeof(v_data -> 'cartography') = 'object'
     and coalesce((v_data #>> '{cartography,skipped}')::boolean, false) = false then
    insert into public.farm_imports (farm_id, source_type, file_name, row_count, valid_count, created_by)
    values (
      v_farm_id,
      'cartografia',
      v_data #>> '{cartography,fileName}',
      coalesce(jsonb_array_length(v_data #> '{cartography,features}'), 0),
      coalesce(jsonb_array_length(v_data #> '{cartography,features}'), 0),
      v_uid
    );
  end if;

  v_quality := v_data -> 'quality';
  if jsonb_typeof(v_quality) = 'object' then
    insert into public.farm_imports (
      farm_id, source_type, file_name, row_count, valid_count, warning_count,
      error_count, quality_score, mapping, issues, created_by
    )
    values (
      v_farm_id,
      'planilla',
      v_quality ->> 'fileName',
      coalesce(public.try_numeric(v_quality ->> 'rowCount')::integer, 0),
      coalesce(public.try_numeric(v_quality ->> 'validCount')::integer, 0),
      coalesce(public.try_numeric(v_quality ->> 'warningCount')::integer, 0),
      coalesce(public.try_numeric(v_quality ->> 'errorCount')::integer, 0),
      public.try_numeric(v_quality ->> 'qualityScore'),
      coalesce(v_quality -> 'mapping', '{}'::jsonb),
      coalesce(v_quality -> 'issues', '[]'::jsonb),
      v_uid
    );
  end if;

  -- Equipo: invitaciones + asignaciones; si el usuario ya existe, se une de inmediato
  for v_member in select * from jsonb_array_elements(coalesce(v_data -> 'team', '[]'::jsonb))
  loop
    continue when coalesce(position('@' in coalesce(v_member ->> 'email', '')), 0) < 2;

    insert into public.farm_invitations (farm_id, email, full_name, role, invited_by)
    values (
      v_farm_id,
      lower(btrim(v_member ->> 'email')),
      nullif(btrim(v_member ->> 'fullName'), ''),
      case when v_member ->> 'role' in ('administrador', 'agronomo', 'muestreador')
           then v_member ->> 'role' else 'muestreador' end,
      v_uid
    )
    on conflict do nothing
    returning id into v_invitation_id;

    continue when v_invitation_id is null;

    select u.id into v_existing_user
    from auth.users u
    where lower(u.email) = lower(btrim(v_member ->> 'email'))
    limit 1;

    if v_existing_user is not null then
      insert into public.profiles (id) values (v_existing_user) on conflict (id) do nothing;

      insert into public.farm_memberships (farm_id, user_id, role, status)
      select v_farm_id, v_existing_user, i.role, 'active'
      from public.farm_invitations i where i.id = v_invitation_id
      on conflict (farm_id, user_id) do nothing;

      update public.farm_invitations
      set status = 'accepted', user_id = v_existing_user, accepted_at = now()
      where id = v_invitation_id;
    end if;

    for v_code in select jsonb_array_elements_text(coalesce(v_member -> 'blockCodes', '[]'::jsonb))
    loop
      select b.id into v_block_id
      from public.blocks b
      where b.farm_id = v_farm_id and b.code = v_code;

      if v_block_id is not null then
        insert into public.block_assignments (farm_id, block_id, invitation_id, user_id)
        values (v_farm_id, v_block_id, v_invitation_id, v_existing_user)
        on conflict do nothing;
      end if;
    end loop;

    v_existing_user := null;
    v_invitation_id := null;
  end loop;

  update public.onboarding_sessions
  set status = 'completed',
      farm_id = v_farm_id,
      current_step = 'listo',
      completed_at = now(),
      updated_at = now(),
      duration_seconds = greatest(0, extract(epoch from (now() - started_at)))::integer
  where id = p_session_id;

  insert into public.onboarding_events (session_id, user_id, step, event)
  values (p_session_id, v_uid, 'equipo', 'completed');

  return v_farm_id;
end;
$$;

revoke all on function public.complete_onboarding(uuid) from public, anon;
grant execute on function public.complete_onboarding(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: equipo del fundo (miembros + invitaciones pendientes, con cuarteles asignados)
-- ---------------------------------------------------------------------------

create or replace function public.get_farm_team(p_farm_id uuid)
returns table (
  kind text,
  user_id uuid,
  full_name text,
  email text,
  role text,
  status text,
  block_codes text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_farm_member(p_farm_id) then
    raise exception 'Sin acceso a este fundo' using errcode = '42501';
  end if;

  return query
  select
    'member'::text,
    m.user_id,
    p.full_name,
    u.email::text,
    m.role,
    m.status,
    coalesce(
      (select array_agg(b.code order by b.code)
       from public.block_assignments a
       join public.blocks b on b.id = a.block_id
       where a.farm_id = p_farm_id and a.user_id = m.user_id),
      '{}'::text[]
    )
  from public.farm_memberships m
  join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.farm_id = p_farm_id

  union all

  select
    'invitation'::text,
    null::uuid,
    i.full_name,
    i.email,
    i.role,
    i.status,
    coalesce(
      (select array_agg(b.code order by b.code)
       from public.block_assignments a
       join public.blocks b on b.id = a.block_id
       where a.invitation_id = i.id),
      '{}'::text[]
    )
  from public.farm_invitations i
  where i.farm_id = p_farm_id and i.status = 'pending';
end;
$$;

revoke all on function public.get_farm_team(uuid) from public, anon;
grant execute on function public.get_farm_team(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: métricas agregadas del onboarding (sin datos personales)
-- ---------------------------------------------------------------------------

create or replace function public.onboarding_metrics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select * from public.onboarding_sessions
  ),
  steps as (
    select e.step, count(distinct e.session_id) as sessions
    from public.onboarding_events e
    where e.event in ('step_view', 'step_complete')
    group by e.step
  ),
  completed_steps as (
    select e.step, count(distinct e.session_id) as sessions
    from public.onboarding_events e
    where e.event = 'step_complete'
    group by e.step
  ),
  skips as (
    select e.step, count(*) as total
    from public.onboarding_events e
    where e.event = 'step_skip'
    group by e.step
  ),
  diag as (
    select diagnostic from s where jsonb_typeof(diagnostic) = 'object'
  ),
  diag_dims as (
    select d.key as dimension, round(avg(public.try_numeric(d.value #>> '{}')), 1) as avg_score
    from diag, jsonb_each(diag.diagnostic -> 'dimensions') d
    group by d.key
  ),
  micro as (
    select
      coalesce(e.metadata ->> 'milestone', e.step) as milestone,
      round(avg(public.try_numeric(e.metadata ->> 'rating')), 2) as avg_rating,
      count(*) as total
    from public.onboarding_events e
    where e.event = 'micro_survey'
    group by 1
  )
  select jsonb_build_object(
    'diagnosticsCount', (select count(*) from diag),
    'avgMaturityScore', (select round(avg(public.try_numeric(diagnostic ->> 'score')), 1) from diag),
    'maturityLevels', coalesce((
      select jsonb_object_agg(level, total)
      from (select diagnostic ->> 'level' as level, count(*) as total from diag group by 1) x
      where level is not null
    ), '{}'::jsonb),
    'maturityByDimension', coalesce((select jsonb_object_agg(dimension, avg_score) from diag_dims), '{}'::jsonb),
    'microSurveys', coalesce((
      select jsonb_object_agg(milestone, jsonb_build_object('avgRating', avg_rating, 'count', total)) from micro
    ), '{}'::jsonb),
    'sessionsStarted', (select count(*) from s),
    'sessionsCompleted', (select count(*) from s where status = 'completed'),
    'sessionsInProgress', (select count(*) from s where status = 'in_progress'),
    'avgDurationSeconds', (select round(avg(duration_seconds)) from s where status = 'completed'),
    'medianDurationSeconds', (
      select percentile_cont(0.5) within group (order by duration_seconds)
      from s where status = 'completed'
    ),
    'under10MinRate', (
      select round(100.0 * count(*) filter (where duration_seconds <= 600) / nullif(count(*), 0), 1)
      from s where status = 'completed'
    ),
    'avgRating', (select round(avg(rating)::numeric, 2) from s where rating is not null),
    'ratingsCount', (select count(*) from s where rating is not null),
    'avgQualityScore', (
      select round(avg(quality_score)::numeric, 1) from public.farm_imports where source_type = 'planilla'
    ),
    'farms', (select count(*) from public.farms),
    'blocks', (select count(*) from public.blocks),
    'invitations', (select count(*) from public.farm_invitations),
    'invitationsAccepted', (select count(*) from public.farm_invitations where status = 'accepted'),
    'stepFunnel', coalesce((select jsonb_object_agg(step, sessions) from steps), '{}'::jsonb),
    'stepCompleted', coalesce((select jsonb_object_agg(step, sessions) from completed_steps), '{}'::jsonb),
    'stepSkips', coalesce((select jsonb_object_agg(step, total) from skips), '{}'::jsonb),
    'abandonedByStep', coalesce((
      select jsonb_object_agg(current_step, total)
      from (select current_step, count(*) as total from s where status = 'in_progress' group by current_step) x
    ), '{}'::jsonb)
  );
$$;

revoke all on function public.onboarding_metrics() from public, anon;
grant execute on function public.onboarding_metrics() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: guardar la encuesta de diagnóstico de madurez digital
-- Se guarda en la sesión y, si el fundo ya existe, también en farms.context.diagnostic
-- (así el panel del fundo puede mostrarla a todos sus miembros).
-- ---------------------------------------------------------------------------

create or replace function public.save_diagnostic(p_session_id uuid, p_diagnostic jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_farm_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  if jsonb_typeof(p_diagnostic) <> 'object' then
    raise exception 'Diagnóstico inválido';
  end if;

  update public.onboarding_sessions
  set diagnostic = p_diagnostic, updated_at = now()
  where id = p_session_id and user_id = v_uid
  returning farm_id into v_farm_id;

  if not found then
    raise exception 'Sesión de onboarding no encontrada';
  end if;

  if v_farm_id is not null and public.is_farm_member(v_farm_id) then
    update public.farms
    set context = coalesce(context, '{}'::jsonb) || jsonb_build_object('diagnostic', p_diagnostic),
        updated_at = now()
    where id = v_farm_id;
  end if;
end;
$$;

revoke all on function public.save_diagnostic(uuid, jsonb) from public, anon;
grant execute on function public.save_diagnostic(uuid, jsonb) to authenticated;
