-- ZAYA — Migration 0004 : documents juridiques, versions, preuves de consentement

-- ---------- Tables ----------
-- Un document = un sujet (Termes, Confidentialité...). Le texte vit dans les versions.
create table public.legal_documents (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9_-]+$'),
  title              text not null,
  -- Vide = à accepter par tous les utilisateurs. Sinon : par les titulaires de ces rôles.
  required_for_roles text[] not null default '{}',
  is_required        boolean not null default true,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now()
);

create table public.legal_document_versions (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.legal_documents(id) on delete restrict,
  version      text not null check (char_length(version) <= 20),
  content      text not null,
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  effective_at timestamptz,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (document_id, version),
  check (status = 'draft' or (published_at is not null and effective_at is not null))
);
create index legal_versions_doc_idx on public.legal_document_versions (document_id, status, effective_at desc);

-- Preuve de consentement. Pas de clé étrangère sur user_id : la table est append-only,
-- donc une suppression de compte en cascade serait refusée, et la preuve doit être conservée.
create table public.user_consents (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  version_id          uuid not null references public.legal_document_versions(id) on delete restrict,
  document_id         uuid not null references public.legal_documents(id) on delete restrict,
  accepted_at         timestamptz not null default now(),
  source              text not null check (source in ('signup', 'gate', 'role_activation')),
  account_type        text,
  roles_at_acceptance text[],
  ip_address          text,
  user_agent          text,
  unique (user_id, version_id)
);
create index user_consents_user_idx    on public.user_consents (user_id);
create index user_consents_version_idx on public.user_consents (version_id);

-- ---------- Garde-fous d'intégrité ----------
-- Une version publiée ne peut plus être modifiée ni supprimée : on publie une nouvelle version.
create function public.legal_versions_guard() returns trigger
language plpgsql as $$
begin
  if old.status = 'published' then
    raise exception 'published legal versions are immutable' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger legal_versions_immutable before update or delete on public.legal_document_versions
  for each row execute function public.legal_versions_guard();

create function public.user_consents_immutable() returns trigger
language plpgsql as $$
begin raise exception 'user_consents is append-only' using errcode = '42501'; end $$;

create trigger user_consents_no_change before update or delete on public.user_consents
  for each row execute function public.user_consents_immutable();

-- ---------- Fonctions ----------
-- Lit un en-tête HTTP de la requête (adresse IP, navigateur) quand elle passe par l'API.
create function public.request_header(p_name text) returns text
language sql stable as $$
  select nullif(nullif(current_setting('request.headers', true), '')::json ->> p_name, '')
$$;

-- Version en vigueur de chaque document : la dernière publiée dont la date d'effet est atteinte.
create function public.current_legal_versions() returns setof public.legal_document_versions
language sql stable security definer set search_path = public as $$
  select distinct on (v.document_id) v.*
  from public.legal_document_versions v
  where v.status = 'published' and v.effective_at <= now()
  order by v.document_id, v.effective_at desc
$$;

-- Documents que l'utilisateur connecté doit encore accepter (nouvelle inscription,
-- nouvelle version publiée, ou règles liées à un rôle qu'il détient).
create function public.pending_legal_versions()
returns table (document_id uuid, version_id uuid, slug text, title text, version text, required_for_roles text[])
language sql stable security definer set search_path = public as $$
  select d.id, cur.id, d.slug, d.title, cur.version, d.required_for_roles
  from public.legal_documents d
  join public.current_legal_versions() cur on cur.document_id = d.id
  where auth.uid() is not null
    and d.is_required
    and (
      cardinality(d.required_for_roles) = 0
      or d.required_for_roles && array(
           select ur.role_code from public.user_roles ur
           where ur.user_id = auth.uid() and ur.status in ('active', 'pending')
         )
    )
    and not exists (
      select 1 from public.user_consents c
      where c.user_id = auth.uid() and c.version_id = cur.id
    )
  order by d.sort_order, d.title
$$;

-- Enregistre l'acceptation de versions EN VIGUEUR (les autres sont refusées).
create function public.accept_legal_versions(p_version_ids uuid[], p_source text default 'gate')
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_source not in ('gate', 'role_activation') then
    raise exception 'invalid_source' using errcode = '22023';
  end if;

  if (select count(*) from public.current_legal_versions() v where v.id = any(p_version_ids))
     <> (select count(distinct x) from unnest(p_version_ids) as x) then
    raise exception 'invalid_legal_version' using errcode = '22023';
  end if;

  insert into public.user_consents
    (user_id, version_id, document_id, source, account_type, roles_at_acceptance, ip_address, user_agent)
  select
    v_uid, v.id, v.document_id, p_source,
    (select p.account_type from public.profiles p where p.id = v_uid),
    array(select ur.role_code from public.user_roles ur
          where ur.user_id = v_uid and ur.status in ('active', 'pending')),
    left(nullif(trim(split_part(coalesce(public.request_header('x-forwarded-for'), ''), ',', 1)), ''), 64),
    left(public.request_header('user-agent'), 300)
  from public.current_legal_versions() v
  where v.id = any(p_version_ids)
  on conflict (user_id, version_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Publication d'un brouillon (administrateurs avec la permission legal.manage).
create function public.publish_legal_version(p_version_id uuid, p_effective_at timestamptz default now())
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
begin
  if not public.has_permission('legal.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_effective_at < now() - interval '5 minutes' then
    raise exception 'effective_date_in_past' using errcode = '22023';
  end if;

  select status into v_status from public.legal_document_versions where id = p_version_id for update;
  if v_status is null then
    raise exception 'unknown_version' using errcode = '22023';
  end if;
  if v_status <> 'draft' then
    raise exception 'version_not_draft' using errcode = '22023';
  end if;

  update public.legal_document_versions
  set status = 'published', published_at = now(), effective_at = p_effective_at
  where id = p_version_id;

  insert into public.audit_logs (actor_id, action, object_type, object_id, new_value)
  values (v_uid, 'legal.publish', 'legal_document_versions', p_version_id::text,
          jsonb_build_object('effective_at', p_effective_at));
end $$;

-- ---------- Sécurité (RLS) ----------
alter table public.legal_documents         enable row level security;
alter table public.legal_document_versions enable row level security;
alter table public.user_consents           enable row level security;

revoke all on public.legal_documents, public.legal_document_versions, public.user_consents
  from anon, authenticated;

-- Les textes publiés et en vigueur sont publics (lisibles avant l'inscription).
grant select on public.legal_documents, public.legal_document_versions to anon, authenticated;

create policy legal_documents_read_anon on public.legal_documents
  for select to anon using (true);
create policy legal_documents_read on public.legal_documents
  for select to authenticated using (true);

create policy legal_versions_read_anon on public.legal_document_versions
  for select to anon using (status = 'published' and effective_at <= now());
create policy legal_versions_read on public.legal_document_versions
  for select to authenticated
  using ((status = 'published' and effective_at <= now()) or public.has_permission('legal.manage'));

-- Écriture : réservée à legal.manage. Les versions ne s'écrivent qu'en brouillon ;
-- le passage en « publié » se fait uniquement via publish_legal_version().
grant insert, update on public.legal_documents to authenticated;
create policy legal_documents_insert on public.legal_documents
  for insert to authenticated with check (public.has_permission('legal.manage'));
create policy legal_documents_update on public.legal_documents
  for update to authenticated
  using (public.has_permission('legal.manage')) with check (public.has_permission('legal.manage'));

grant insert (document_id, version, content), update (version, content), delete
  on public.legal_document_versions to authenticated;
create policy legal_versions_insert on public.legal_document_versions
  for insert to authenticated with check (status = 'draft' and public.has_permission('legal.manage'));
create policy legal_versions_update on public.legal_document_versions
  for update to authenticated
  using (status = 'draft' and public.has_permission('legal.manage'))
  with check (status = 'draft' and public.has_permission('legal.manage'));
create policy legal_versions_delete on public.legal_document_versions
  for delete to authenticated using (status = 'draft' and public.has_permission('legal.manage'));

-- Consentements : chacun lit les siens ; aucune écriture directe.
grant select on public.user_consents to authenticated;
create policy user_consents_select on public.user_consents
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('users.read'));

-- ---------- Droits d'exécution ----------
revoke all on function public.request_header(text), public.current_legal_versions(),
  public.pending_legal_versions(), public.accept_legal_versions(uuid[], text),
  public.publish_legal_version(uuid, timestamptz) from public, anon, authenticated;

grant execute on function public.current_legal_versions() to anon, authenticated;
grant execute on function public.pending_legal_versions(), public.accept_legal_versions(uuid[], text),
  public.publish_legal_version(uuid, timestamptz) to authenticated;