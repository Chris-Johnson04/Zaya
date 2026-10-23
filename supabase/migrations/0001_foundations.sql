-- ZAYA — Migration 0001 : comptes, rôles, permissions, audit

-- ---------- Tables ----------
create table public.roles (
  code  text primary key,
  label text not null,
  kind  text not null check (kind in ('user', 'admin'))
);

create table public.permissions (
  code        text primary key,
  description text not null
);

create table public.role_permissions (
  role_code       text not null references public.roles(code) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text check (char_length(full_name) <= 120),
  phone        text check (char_length(phone) <= 30),
  avatar_url   text,
  account_type text not null default 'individual'
               check (account_type in ('individual', 'professional', 'company')),
  city         text check (char_length(city) <= 80),
  country      text not null default 'CG',
  locale       text not null default 'fr',
  status       text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.user_roles (
  user_id    uuid not null references auth.users(id) on delete cascade,
  role_code  text not null references public.roles(code),
  status     text not null default 'active' check (status in ('active', 'pending', 'suspended')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role_code)
);
create index user_roles_role_idx on public.user_roles (role_code);

-- Journal append-only : pas de clé étrangère pour survivre à la suppression d'un compte.
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  object_type text not null,
  object_id   text,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_object_idx  on public.audit_logs (object_type, object_id);

-- ---------- Triggers utilitaires ----------
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch   before update on public.profiles   for each row execute function public.touch_updated_at();
create trigger user_roles_touch before update on public.user_roles for each row execute function public.touch_updated_at();

create function public.audit_logs_immutable() returns trigger
language plpgsql as $$
begin raise exception 'audit_logs is append-only' using errcode = '42501'; end $$;

create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- ---------- Fonctions d'autorisation (utilisées par la RLS) ----------
create function public.has_role(p_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.status = 'active'
    where ur.user_id = auth.uid() and ur.role_code = p_role and ur.status = 'active'
  )
$$;

create function public.has_permission(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.status = 'active'
    where ur.user_id = auth.uid()
      and ur.status = 'active'
      and (
        ur.role_code = 'super_admin'
        or exists (
          select 1 from public.role_permissions rp
          where rp.role_code = ur.role_code and rp.permission_code = p_permission
        )
      )
  )
$$;

-- ---------- Création automatique du profil à l'inscription ----------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_type text := coalesce(new.raw_user_meta_data ->> 'account_type', 'individual');
begin
  if v_type not in ('individual', 'professional', 'company') then
    v_type := 'individual';
  end if;

  insert into public.profiles (id, full_name, phone, account_type)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), ''),
    nullif(new.phone, ''),
    v_type
  );

  -- Tout nouveau compte est Client. Les autres rôles passent par les fonctions ci-dessous.
  insert into public.user_roles (user_id, role_code) values (new.id, 'client');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Activation d'un rôle par l'utilisateur lui-même ----------
-- Vendeur, entreprise, créateur : actifs immédiatement (tout le monde peut vendre).
-- Livreur : en attente jusqu'à vérification par un administrateur.
-- Les rôles d'administration ne sont JAMAIS auto-attribuables.
create function public.activate_self_role(p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_role not in ('vendor', 'business', 'creator', 'driver') then
    raise exception 'role_not_self_assignable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'account_not_active' using errcode = '42501';
  end if;

  v_status := case when p_role = 'driver' then 'pending' else 'active' end;

  insert into public.user_roles (user_id, role_code, status, granted_by)
  values (v_uid, p_role, v_status, v_uid)
  on conflict (user_id, role_code) do nothing;

  insert into public.audit_logs (actor_id, action, object_type, object_id, new_value)
  values (v_uid, 'role.self_activate', 'user_roles', v_uid::text,
          jsonb_build_object('role', p_role, 'status', v_status));

  select status into v_status from public.user_roles where user_id = v_uid and role_code = p_role;
  return v_status;
end $$;

-- ---------- Gestion des rôles par un administrateur ----------
-- p_status : 'active' | 'pending' | 'suspended' | 'revoked' (supprime le rôle)
create function public.admin_set_role(p_user uuid, p_role text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_kind text;
  v_old  jsonb;
begin
  if not public.has_permission('users.manage_roles') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = v_uid then
    raise exception 'cannot_change_own_roles' using errcode = '42501';
  end if;
  if p_status not in ('active', 'pending', 'suspended', 'revoked') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  select kind into v_kind from public.roles where code = p_role;
  if v_kind is null then
    raise exception 'unknown_role' using errcode = '22023';
  end if;
  -- Seul un Super Admin gère les rôles d'administration.
  if v_kind = 'admin' and not public.has_role('super_admin') then
    raise exception 'forbidden_admin_role' using errcode = '42501';
  end if;

  select to_jsonb(ur) into v_old from public.user_roles ur where user_id = p_user and role_code = p_role;

  if p_status = 'revoked' then
    delete from public.user_roles where user_id = p_user and role_code = p_role;
  else
    insert into public.user_roles (user_id, role_code, status, granted_by)
    values (p_user, p_role, p_status, v_uid)
    on conflict (user_id, role_code)
    do update set status = excluded.status, granted_by = v_uid;
  end if;

  insert into public.audit_logs (actor_id, action, object_type, object_id, old_value, new_value)
  values (v_uid, 'role.set', 'user_roles', p_user::text, v_old,
          jsonb_build_object('role', p_role, 'status', p_status));
end $$;

-- Exécution : jamais pour anon.
revoke all on function public.has_role(text), public.has_permission(text),
  public.activate_self_role(text), public.admin_set_role(uuid, text, text) from public, anon;
grant execute on function public.has_role(text), public.has_permission(text),
  public.activate_self_role(text), public.admin_set_role(uuid, text, text) to authenticated;