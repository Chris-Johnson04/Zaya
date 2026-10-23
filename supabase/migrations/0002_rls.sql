-- ZAYA — Migration 0002 : Row Level Security

alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles         enable row level security;
alter table public.user_roles       enable row level security;
alter table public.audit_logs       enable row level security;

-- Aucun accès anonyme à ces tables.
revoke all on public.roles, public.permissions, public.role_permissions,
  public.profiles, public.user_roles, public.audit_logs from anon;

-- Référentiels : lecture seule pour les utilisateurs connectés.
create policy roles_read            on public.roles            for select to authenticated using (true);
create policy permissions_read      on public.permissions      for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);

-- Profils : chacun voit le sien ; le personnel autorisé voit les autres.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission('users.read'));

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Un utilisateur ne peut modifier que ces colonnes (pas `status`, pas `country`).
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, account_type, city, locale) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated;

-- Rôles utilisateur : lecture des siens ; aucune écriture directe (passer par les fonctions).
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_permission('users.read'));
revoke insert, update, delete on public.user_roles from authenticated;

-- Audit : lecture réservée ; aucune écriture directe.
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.has_permission('audit.read'));
revoke insert, update, delete on public.audit_logs from authenticated;