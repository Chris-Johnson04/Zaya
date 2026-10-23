-- ZAYA — Migration 0011 : informations publiques d'un vendeur
-- Prérequis : migration 0008 (annonces) exécutée.

-- Renvoie uniquement : nom abrégé, type de compte, ville, ancienneté, nombre d'annonces en ligne.
-- Jamais le téléphone, l'e-mail, ni l'adresse.
-- Ne répond que pour un vendeur actif qui a au moins une annonce EN LIGNE : impossible
-- de s'en servir pour fouiller les comptes qui n'ont rien publié.
create function public.get_seller_public(p_seller_id uuid)
returns table (
  display_name    text,
  account_type    text,
  city            text,
  member_since    timestamptz,
  active_listings bigint
)
language sql stable security definer set search_path = public as $$
  select
    case
      when p.full_name is null or trim(p.full_name) = '' then null
      -- Un seul mot : tel quel.
      when position(' ' in trim(p.full_name)) = 0 then left(trim(p.full_name), 40)
      -- Plusieurs mots : le premier, puis l'initiale du reste (« Marie D. »).
      else left(split_part(trim(p.full_name), ' ', 1), 40) || ' ' ||
           upper(left(trim(substr(trim(p.full_name), position(' ' in trim(p.full_name)) + 1)), 1)) || '.'
    end,
    p.account_type,
    p.city,
    p.created_at,
    c.n
  from public.profiles p
  cross join lateral (
    select count(*) as n
    from public.listings l
    where l.seller_id = p.id and l.status = 'active'
  ) c
  where p.id = p_seller_id
    and p.status = 'active'
    and c.n > 0
$$;

revoke all on function public.get_seller_public(uuid) from public, anon, authenticated;
grant execute on function public.get_seller_public(uuid) to anon, authenticated;