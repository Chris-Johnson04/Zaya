-- ZAYA — Migration 0010 : droits explicites sur les tables des migrations 0001 et 0002
--
-- À partir du 30 octobre, Supabase n'accorde plus automatiquement l'accès à l'API
-- aux nouvelles tables. Les migrations 0001 et 0002 comptaient encore sur ces droits
-- automatiques pour la lecture. Ce script les écrit explicitement.
--
-- Sans effet sur la base actuelle (les droits existent déjà), mais indispensable pour
-- recréer l'environnement : nouveau projet, branche de test, "supabase db reset".
-- La sécurité réelle reste assurée par la RLS : ces droits n'ouvrent rien de plus.

-- Référentiels : lisibles par tout utilisateur connecté.
grant select on public.roles, public.permissions, public.role_permissions to authenticated;

-- Profils, rôles, audit : la RLS décide de ce que chacun peut voir.
grant select on public.profiles, public.user_roles, public.audit_logs to authenticated;