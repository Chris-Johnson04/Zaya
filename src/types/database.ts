export type RoleCode =
  | 'client'
  | 'vendor'
  | 'business'
  | 'creator'
  | 'driver'
  | 'super_admin'
  | 'finance_admin'
  | 'operations_admin'
  | 'vendor_manager'
  | 'creator_manager'
  | 'support_admin'
  | 'security_admin'

export const ADMIN_ROLES: RoleCode[] = [
  'super_admin',
  'finance_admin',
  'operations_admin',
  'vendor_manager',
  'creator_manager',
  'support_admin',
  'security_admin',
]

// Rôles que l'utilisateur peut activer lui-même (cf. activate_self_role en SQL).
export const SELF_ASSIGNABLE_ROLES: RoleCode[] = ['vendor', 'business', 'creator', 'driver']

export const ROLE_LABELS: Record<RoleCode, string> = {
  client: 'Client',
  vendor: 'Vendeur',
  business: 'Entreprise',
  creator: 'Créateur',
  driver: 'Livreur',
  super_admin: 'Super Admin',
  finance_admin: 'Admin Finance',
  operations_admin: 'Admin Opérations',
  vendor_manager: 'Gestionnaire vendeurs',
  creator_manager: 'Gestionnaire créateurs',
  support_admin: 'Admin Support',
  security_admin: 'Admin Sécurité',
}

export type AccountType = 'individual' | 'professional' | 'company'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  individual: 'Particulier',
  professional: 'Professionnel',
  company: 'Entreprise',
}

export type AccountStatus = 'active' | 'suspended' | 'closed'
export type RoleStatus = 'active' | 'pending' | 'suspended'

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  account_type: AccountType
  city: string | null
  country: string
  locale: string
  status: AccountStatus
  created_at: string
  updated_at: string
}

export interface UserRole {
  role_code: RoleCode
  status: RoleStatus
}