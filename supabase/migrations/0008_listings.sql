-- ZAYA — Migration 0008 : annonces (produits et services)
-- Prérequis : migration 0007 (catégories) exécutée.

-- ---------- Permission de modération ----------
insert into public.permissions (code, description) values
  ('listings.moderate', 'Retirer ou rétablir des annonces');

insert into public.role_permissions (role_code, permission_code) values
  ('vendor_manager', 'listings.moderate'),
  ('support_admin',  'listings.moderate'),
  ('security_admin', 'listings.moderate');

-- ---------- Table ----------
create table public.listings (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  -- Copie du type de compte du vendeur au moment de la publication (particulier, professionnel, entreprise).
  seller_type    text not null check (seller_type in ('individual', 'professional', 'company')),
  category_id    uuid not null references public.categories(id) on delete restrict,
  kind           text not null check (kind in ('product', 'service')),
  condition      text check (condition in ('new', 'used')),
  title          text not null check (char_length(title) between 5 and 120),
  description    text not null default '' check (char_length(description) <= 4000),
  price_type     text not null default 'fixed' check (price_type in ('fixed', 'negotiable', 'quote')),
  price          bigint check (price between 1 and 10000000000),
  currency       text not null default 'XAF' check (currency = 'XAF'),
  city           text check (char_length(city) <= 80),
  country        text not null default 'CG',
  status         text not null default 'draft'
                 check (status in ('draft', 'active', 'paused', 'sold', 'removed')),
  removed_reason text,
  removed_at     timestamptz,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Recherche en texte intégral (français) : le titre compte plus que la description.
  search         tsvector generated always as (
                   setweight(to_tsvector('french', coalesce(title, '')), 'A') ||
                   setweight(to_tsvector('french', coalesce(description, '')), 'B')
                 ) stored,
  -- Un produit est neuf ou d'occasion ; un service n'a pas d'état.
  check ((kind = 'product' and condition is not null) or (kind = 'service' and condition is null)),
  -- Un prix est obligatoire, sauf pour une annonce « sur devis ».
  check ((price_type = 'quote' and price is null) or (price_type <> 'quote' and price is not null))
);

create index listings_search_idx   on public.listings using gin (search);
create index listings_feed_idx     on public.listings (published_at desc, id desc) where status = 'active';
create index listings_category_idx on public.listings (category_id) where status = 'active';
create index listings_filter_idx   on public.listings (kind, condition, city) where status = 'active';
create index listings_seller_idx   on public.listings (seller_id, status);

-- ---------- Garde-fous ----------
create function public.listings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cat_kind   text;
  v_cat_active boolean;
begin
  if tg_op = 'INSERT' then
    select account_type into new.seller_type from public.profiles where id = new.seller_id;
  elsif new.seller_id <> old.seller_id or new.kind <> old.kind or new.seller_type <> old.seller_type then
    raise exception 'listing_immutable_field' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' or new.category_id <> old.category_id then
    select c.kind, c.is_active into v_cat_kind, v_cat_active
    from public.categories c where c.id = new.category_id;
    if v_cat_kind is null or not v_cat_active then
      raise exception 'invalid_category' using errcode = '22023';
    end if;
    if v_cat_kind <> new.kind then
      raise exception 'category_kind_mismatch' using errcode = '22023';
    end if;
  end if;

  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

create trigger listings_guard_trg before insert or update on public.listings
  for each row execute function public.listings_guard();

create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();

-- ---------- Sécurité (RLS) ----------
alter table public.listings enable row level security;

revoke all on public.listings from anon, authenticated;
grant select on public.listings to anon, authenticated;

-- Les annonces actives sont publiques. Le vendeur voit toutes les siennes.
create policy listings_read_anon on public.listings
  for select to anon using (status = 'active');

create policy listings_read on public.listings
  for select to authenticated
  using (status = 'active' or seller_id = auth.uid() or public.has_permission('listings.moderate'));

-- Publier : réservé aux titulaires du rôle Vendeur ou Entreprise, uniquement pour soi.
grant insert (category_id, kind, condition, title, description, price_type, price, city, status)
  on public.listings to authenticated;

create policy listings_insert on public.listings
  for insert to authenticated
  with check (
    seller_id = auth.uid()
    and status in ('draft', 'active')
    and (public.has_role('vendor') or public.has_role('business'))
  );

-- Modifier : jamais le vendeur, le type, ni le statut « removed » (réservé à la modération).
grant update (category_id, condition, title, description, price_type, price, city, status)
  on public.listings to authenticated;

create policy listings_update on public.listings
  for update to authenticated
  using (seller_id = auth.uid() and status <> 'removed')
  with check (
    seller_id = auth.uid()
    and status in ('draft', 'active', 'paused', 'sold')
    and (public.has_role('vendor') or public.has_role('business'))
  );

-- Supprimer : uniquement un brouillon. Une annonce publiée se met en pause ou se marque vendue.
grant delete on public.listings to authenticated;

create policy listings_delete on public.listings
  for delete to authenticated using (seller_id = auth.uid() and status = 'draft');

-- ---------- Modération ----------
create function public.remove_listing(p_listing_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old text;
begin
  if not public.has_permission('listings.moderate') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 5 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select status into v_old from public.listings where id = p_listing_id for update;
  if v_old is null then
    raise exception 'unknown_listing' using errcode = '22023';
  end if;

  update public.listings
  set status = 'removed', removed_reason = trim(p_reason), removed_at = now()
  where id = p_listing_id;

  insert into public.audit_logs (actor_id, action, object_type, object_id, old_value, new_value)
  values (auth.uid(), 'listing.remove', 'listings', p_listing_id::text,
          jsonb_build_object('status', v_old),
          jsonb_build_object('status', 'removed', 'reason', trim(p_reason)));
end $$;

-- Rétablit une annonce retirée : elle revient « en pause », le vendeur décide de la republier.
create function public.restore_listing(p_listing_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old   text;
  v_reason text;
begin
  if not public.has_permission('listings.moderate') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select status, removed_reason into v_old, v_reason
  from public.listings where id = p_listing_id for update;
  if v_old is null then
    raise exception 'unknown_listing' using errcode = '22023';
  end if;
  if v_old <> 'removed' then
    raise exception 'listing_not_removed' using errcode = '22023';
  end if;

  update public.listings
  set status = 'paused', removed_reason = null, removed_at = null
  where id = p_listing_id;

  insert into public.audit_logs (actor_id, action, object_type, object_id, old_value, new_value)
  values (auth.uid(), 'listing.restore', 'listings', p_listing_id::text,
          jsonb_build_object('status', 'removed', 'reason', v_reason),
          jsonb_build_object('status', 'paused'));
end $$;

revoke all on function public.remove_listing(uuid, text), public.restore_listing(uuid)
  from public, anon;
grant execute on function public.remove_listing(uuid, text), public.restore_listing(uuid)
  to authenticated;