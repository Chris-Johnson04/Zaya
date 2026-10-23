-- ZAYA — Migration 0007 : catégories de la marketplace

-- ---------- Table ----------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.categories(id) on delete restrict,
  slug       text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name       text not null check (char_length(name) between 2 and 80),
  kind       text not null check (kind in ('product', 'service')),
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index categories_parent_idx on public.categories (parent_id);
create index categories_kind_idx   on public.categories (kind, sort_order);

-- ---------- Permission de gestion ----------
insert into public.permissions (code, description) values
  ('catalog.manage', 'Gérer les catégories du catalogue');

-- Le Super Admin a déjà tous les droits. L'Admin Opérations gère aussi le catalogue.
insert into public.role_permissions (role_code, permission_code) values
  ('operations_admin', 'catalog.manage');

-- ---------- Sécurité (RLS) ----------
alter table public.categories enable row level security;

revoke all on public.categories from anon, authenticated;

-- Les catégories actives sont publiques : on les voit sans compte.
grant select on public.categories to anon, authenticated;

create policy categories_read_anon on public.categories
  for select to anon using (is_active);

create policy categories_read on public.categories
  for select to authenticated
  using (is_active or public.has_permission('catalog.manage'));

-- Écriture réservée à catalog.manage. Pas de suppression : on désactive une catégorie.
grant insert, update on public.categories to authenticated;

create policy categories_insert on public.categories
  for insert to authenticated with check (public.has_permission('catalog.manage'));

create policy categories_update on public.categories
  for update to authenticated
  using (public.has_permission('catalog.manage'))
  with check (public.has_permission('catalog.manage'));

-- ---------- Catégories de départ (à ajuster) ----------
insert into public.categories (slug, name, kind, sort_order) values
  ('telephones-tablettes',      'Téléphones et tablettes',          'product', 10),
  ('informatique',              'Informatique',                     'product', 20),
  ('electronique-electromenager','Électronique et électroménager',  'product', 30),
  ('mode-vetements',            'Mode et vêtements',                'product', 40),
  ('maison-decoration',         'Maison et décoration',             'product', 50),
  ('beaute-sante',              'Beauté et santé',                  'product', 60),
  ('alimentation-boissons',     'Alimentation et boissons',         'product', 70),
  ('vehicules-pieces',          'Véhicules et pièces',              'product', 80),
  ('bricolage-materiaux',       'Bricolage et matériaux',           'product', 90),
  ('sport-loisirs',             'Sport et loisirs',                 'product', 100),
  ('bebe-enfants',              'Bébé et enfants',                  'product', 110),
  ('autres-produits',           'Autres produits',                  'product', 120),

  ('reparation-depannage',      'Réparation et dépannage',          'service', 210),
  ('batiment-travaux',          'Bâtiment et travaux',              'service', 220),
  ('transport-demenagement',    'Transport et déménagement',        'service', 230),
  ('beaute-coiffure',           'Beauté et coiffure',               'service', 240),
  ('cours-formation',           'Cours et formation',               'service', 250),
  ('evenements-restauration',   'Événements et restauration',       'service', 260),
  ('informatique-web',          'Informatique et web',              'service', 270),
  ('autres-services',           'Autres services',                  'service', 280);