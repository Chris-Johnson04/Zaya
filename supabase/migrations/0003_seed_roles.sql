-- ZAYA — Migration 0003 : rôles et permissions de référence

insert into public.roles (code, label, kind) values
  ('client',           'Client',                  'user'),
  ('vendor',           'Vendeur',                 'user'),
  ('business',         'Entreprise',              'user'),
  ('creator',          'Créateur',                'user'),
  ('driver',           'Livreur',                 'user'),
  ('super_admin',      'Super Admin',             'admin'),
  ('finance_admin',    'Admin Finance',           'admin'),
  ('operations_admin', 'Admin Opérations',        'admin'),
  ('vendor_manager',   'Gestionnaire vendeurs',   'admin'),
  ('creator_manager',  'Gestionnaire créateurs',  'admin'),
  ('support_admin',    'Admin Support',           'admin'),
  ('security_admin',   'Admin Sécurité',          'admin');

insert into public.permissions (code, description) values
  ('users.read',         'Consulter les comptes utilisateurs'),
  ('users.suspend',      'Suspendre / réactiver un compte'),
  ('users.manage_roles', 'Attribuer ou retirer des rôles'),
  ('vendors.manage',     'Vérifier et gérer les vendeurs'),
  ('creators.manage',    'Gérer les créateurs'),
  ('drivers.manage',     'Vérifier et gérer les livreurs'),
  ('orders.read',        'Consulter les commandes'),
  ('deliveries.manage',  'Suivre et gérer les livraisons'),
  ('finance.read',       'Consulter les données financières'),
  ('finance.manage',     'Gérer commissions et paiements'),
  ('refunds.manage',     'Traiter les remboursements'),
  ('incidents.manage',   'Traiter les incidents et litiges'),
  ('fraud.manage',       'Gérer la fraude et les sanctions'),
  ('audit.read',         'Consulter le journal d''audit'),
  ('legal.manage',       'Gérer les documents juridiques');

-- Super Admin : accès complet via has_permission(), pas de liste nécessaire.
insert into public.role_permissions (role_code, permission_code) values
  ('finance_admin',    'finance.read'),
  ('finance_admin',    'finance.manage'),
  ('finance_admin',    'refunds.manage'),
  ('finance_admin',    'orders.read'),
  ('operations_admin', 'orders.read'),
  ('operations_admin', 'deliveries.manage'),
  ('operations_admin', 'drivers.manage'),
  ('operations_admin', 'incidents.manage'),
  ('vendor_manager',   'users.read'),
  ('vendor_manager',   'vendors.manage'),
  ('vendor_manager',   'orders.read'),
  ('creator_manager',  'users.read'),
  ('creator_manager',  'creators.manage'),
  ('support_admin',    'users.read'),
  ('support_admin',    'users.suspend'),
  ('support_admin',    'orders.read'),
  ('support_admin',    'incidents.manage'),
  ('support_admin',    'refunds.manage'),
  ('security_admin',   'users.read'),
  ('security_admin',   'users.suspend'),
  ('security_admin',   'fraud.manage'),
  ('security_admin',   'audit.read'),
  ('security_admin',   'incidents.manage');