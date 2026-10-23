import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { ADMIN_ROLES, type Profile, type RoleCode, type UserRole } from '@/types/database'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  roles: UserRole[]
  loading: boolean
  isAdmin: boolean
  hasRole: (...codes: RoleCode[]) => boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [sessionLoading, setSessionLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(true)

  // 1. Suivre la session Supabase.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSessionLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // 2. Charger le profil et les rôles de l'utilisateur connecté.
  const userId = session?.user.id

  const load = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setRoles([])
      return
    }
    const [profileResult, rolesResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role_code, status').eq('user_id', userId),
    ])
    setProfile((profileResult.data as Profile | null) ?? null)
    setRoles((rolesResult.data as UserRole[] | null) ?? [])
  }, [userId])

  useEffect(() => {
    let cancelled = false
    setDataLoading(true)
    load().finally(() => {
      if (!cancelled) setDataLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [load])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthState>(() => {
    const activeRoles = roles.filter((r) => r.status === 'active').map((r) => r.role_code)
    return {
      session,
      user: session?.user ?? null,
      profile,
      roles,
      loading: sessionLoading || dataLoading,
      isAdmin: activeRoles.some((r) => ADMIN_ROLES.includes(r)),
      hasRole: (...codes) => codes.some((c) => activeRoles.includes(c)),
      refresh: load,
      signOut,
    }
  }, [session, profile, roles, sessionLoading, dataLoading, load, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}