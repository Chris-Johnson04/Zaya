-- ZAYA — Migration 0006 : le consentement devient obligatoire
--   1. à l'inscription (Termes et Confidentialité)
--   2. à l'activation d'un rôle (règles propres au rôle)

-- ---------- 1. Inscription ----------
-- Le frontend envoie les identifiants des versions cochées dans les métadonnées
-- (accepted_version_ids). Le trigger vérifie que TOUS les documents obligatoires
-- pour tout le monde sont acceptés, puis enregistre la preuve. Sans cela, le compte
-- n'est pas créé : le serveur ne se fie pas aux cases à cocher du navigateur.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_type     text   := coalesce(new.raw_user_meta_data ->> 'account_type', 'individual');
  v_accepted uuid[] := '{}';
  v_missing  int;
begin
  if v_type not in ('individual', 'professional', 'company') then
    v_type := 'individual';
  end if;

  if jsonb_typeof(new.raw_user_meta_data -> 'accepted_version_ids') = 'array' then
    v_accepted := array(
      select x::uuid
      from jsonb_array_elements_text(new.raw_user_meta_data -> 'accepted_version_ids') as x
      where x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      limit 20
    );
  end if;

  select count(*) into v_missing
  from public.current_legal_versions() cur
  join public.legal_documents d on d.id = cur.document_id
  where d.is_required
    and cardinality(d.required_for_roles) = 0
    and not (cur.id = any(v_accepted));

  if v_missing > 0 then
    raise exception 'legal_consent_required' using errcode = '22023';
  end if;

  insert into public.profiles (id, full_name, phone, account_type)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), ''),
    nullif(new.phone, ''),
    v_type
  );

  insert into public.user_roles (user_id, role_code) values (new.id, 'client');

  insert into public.user_consents
    (user_id, version_id, document_id, source, account_type, roles_at_acceptance)
  select new.id, cur.id, cur.document_id, 'signup', v_type, array['client']
  from public.current_legal_versions() cur
  where cur.id = any(v_accepted)
  on conflict (user_id, version_id) do nothing;

  return new;
end $$;

-- ---------- 2. Activation d'un rôle ----------
-- Remplace la version de la migration 0001 : la nouvelle accepte les versions cochées
-- et refuse d'activer le rôle si un document obligatoire pour ce rôle n'est pas accepté.
drop function public.activate_self_role(text);

create function public.activate_self_role(p_role text, p_version_ids uuid[] default '{}')
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_status  text;
  v_missing int;
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

  -- Seules des versions en vigueur peuvent être acceptées.
  if (select count(*) from public.current_legal_versions() v where v.id = any(p_version_ids))
     <> (select count(distinct x) from unnest(p_version_ids) as x) then
    raise exception 'invalid_legal_version' using errcode = '22023';
  end if;

  insert into public.user_consents
    (user_id, version_id, document_id, source, account_type, roles_at_acceptance, ip_address, user_agent)
  select
    v_uid, v.id, v.document_id, 'role_activation',
    (select p.account_type from public.profiles p where p.id = v_uid),
    array(select ur.role_code from public.user_roles ur
          where ur.user_id = v_uid and ur.status in ('active', 'pending')) || p_role,
    left(nullif(trim(split_part(coalesce(public.request_header('x-forwarded-for'), ''), ',', 1)), ''), 64),
    left(public.request_header('user-agent'), 300)
  from public.current_legal_versions() v
  where v.id = any(p_version_ids)
  on conflict (user_id, version_id) do nothing;

  -- Tout document obligatoire pour ce rôle doit être accepté (maintenant ou avant).
  select count(*) into v_missing
  from public.current_legal_versions() cur
  join public.legal_documents d on d.id = cur.document_id
  where d.is_required
    and p_role = any(d.required_for_roles)
    and not exists (
      select 1 from public.user_consents c
      where c.user_id = v_uid and c.version_id = cur.id
    );

  if v_missing > 0 then
    raise exception 'legal_consent_required' using errcode = '22023';
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

revoke all on function public.activate_self_role(text, uuid[]) from public, anon;
grant execute on function public.activate_self_role(text, uuid[]) to authenticated;