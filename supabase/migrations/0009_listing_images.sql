-- ZAYA — Migration 0009 : photos des annonces
-- Prérequis : migration 0008 (annonces) exécutée.

-- ---------- Espace de stockage ----------
-- Public en lecture : les photos d'annonces sont faites pour être vues.
-- Limites : 5 Mo par fichier, JPEG / PNG / WebP uniquement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images', 'listing-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Chaque vendeur n'écrit que dans son propre dossier : <id du vendeur>/<id de l'annonce>/<fichier>
create policy listing_images_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (public.has_role('vendor') or public.has_role('business'))
  );

create policy listing_images_remove on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- Table ----------
create table public.listing_images (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 300),
  position     int  not null default 0 check (position between 0 and 20),
  created_at   timestamptz not null default now()
);
create index listing_images_listing_idx on public.listing_images (listing_id, position);

-- ---------- Garde-fous ----------
-- Le chemin doit être <vendeur>/<annonce>/...  et une annonce porte 8 photos au maximum.
create function public.listing_images_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_seller uuid;
  v_prefix text;
  v_count  int;
begin
  select seller_id into v_seller from public.listings where id = new.listing_id;
  if v_seller is null then
    raise exception 'unknown_listing' using errcode = '22023';
  end if;

  v_prefix := v_seller::text || '/' || new.listing_id::text || '/';
  if left(new.storage_path, length(v_prefix)) <> v_prefix or new.storage_path like '%..%' then
    raise exception 'invalid_image_path' using errcode = '22023';
  end if;

  select count(*) into v_count from public.listing_images where listing_id = new.listing_id;
  if v_count >= 8 then
    raise exception 'too_many_images' using errcode = '22023';
  end if;

  return new;
end $$;

create trigger listing_images_guard_trg before insert on public.listing_images
  for each row execute function public.listing_images_guard();

-- Une annonce ne peut devenir « active » que si elle a au moins une photo.
-- Conséquence : on crée d'abord un brouillon, on ajoute les photos, puis on publie.
create function public.listings_require_image() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active')
     and not exists (select 1 from public.listing_images where listing_id = new.id) then
    raise exception 'listing_needs_image' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger listings_require_image_trg before insert or update on public.listings
  for each row execute function public.listings_require_image();

-- ---------- Sécurité (RLS) ----------
alter table public.listing_images enable row level security;

revoke all on public.listing_images from anon, authenticated;
grant select on public.listing_images to anon, authenticated;

-- Les sous-requêtes ci-dessous passent par la RLS des annonces : on ne voit donc
-- que les photos des annonces qu'on a le droit de voir.
create policy listing_images_read_anon on public.listing_images
  for select to anon
  using (exists (select 1 from public.listings l where l.id = listing_id));

create policy listing_images_read on public.listing_images
  for select to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));

grant insert (listing_id, storage_path, position) on public.listing_images to authenticated;
grant update (position) on public.listing_images to authenticated;
grant delete on public.listing_images to authenticated;

create policy listing_images_insert on public.listing_images
  for insert to authenticated
  with check (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.seller_id = auth.uid() and l.status <> 'removed'
  ));

create policy listing_images_update on public.listing_images
  for update to authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.seller_id = auth.uid() and l.status <> 'removed'
  ))
  with check (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.seller_id = auth.uid() and l.status <> 'removed'
  ));

create policy listing_images_delete on public.listing_images
  for delete to authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.seller_id = auth.uid() and l.status <> 'removed'
  ));