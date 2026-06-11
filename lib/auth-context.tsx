"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import {
  login as apiLogin,
  signup as apiSignup,
  logout as apiLogout,
  getStoredUser,
  type AuthUser,
} from "@/lib/api"

interface AuthContextValue {
  user: AuthUser | null
  /** True until the initial localStorage read completes (avoids redirect flicker). */
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (fullName: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Hydrate auth state from localStorage once on mount (client-only).
  // try/finally guarantees `loading` clears even if storage access throws
  // (e.g. private mode) — otherwise a guard could sit on "Checking…" forever.
  useEffect(() => {
    try {
      setUser(getStoredUser())
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }

    // Keep tabs in sync — logging out in one tab updates the others.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "token" || e.key === "user") setUser(getStoredUser())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    setUser(data.user)
  }, [])

  const signup = useCallback(
    async (fullName: string, email: string, password: string) => {
      const data = await apiSignup(fullName, email, password)
      setUser(data.user)
    },
    []
  )

  const logout = useCallback(() => {
    apiLogout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthenticated: !!user, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
