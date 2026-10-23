-- ZAYA — Migration 0013 : une annonce en ligne garde toujours au moins une photo
-- Prérequis : migration 0009 (photos des annonces) exécutée.

create function public.listing_images_keep_last() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  -- Verrou sur l'annonce : deux suppressions simultanées ne peuvent pas retirer
  -- chacune « l'autre » photo.
  select status into v_status from public.listings where id = old.listing_id for update;

  -- Annonce déjà supprimée (suppression en cascade d'un brouillon) : rien à protéger.
  if v_status is null then
    return old;
  end if;

  if v_status = 'active'
     and not exists (
       select 1 from public.listing_images
       where listing_id = old.listing_id and id <> old.id
     ) then
    raise exception 'listing_must_keep_image' using errcode = '22023';
  end if;

  return old;
end $$;

create trigger listing_images_keep_last_trg before delete on public.listing_images
  for each row execute function public.listing_images_keep_last();