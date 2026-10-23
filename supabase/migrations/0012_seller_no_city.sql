-- ZAYA — Migration 0012 : la fiche publique d'un vendeur n'expose plus la ville du profil
--
-- La ville du profil est une donnée personnelle que le vendeur n'a pas choisi de rendre
-- publique. Chaque annonce porte déjà sa propre ville, choisie pour cette vente.
-- On retire donc la colonne « city » de la fonction publique.

-- Le type de retour change : il faut supprimer la fonction avant de la recréer.
drop function public.get_seller_public(uuid);

create function public.get_seller_public(p_seller_id uuid)
returns table (
  display_name    text,
  account_type    text,
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