"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

/**
 * Client-side route guard. Wrap a protected page's content with this.
 * Unauthenticated users are redirected to /login once auth state has loaded.
 *
 * Protection is client-side because the JWT lives in localStorage, which
 * Next.js edge middleware cannot read.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login")
    }
  }, [loading, isAuthenticated, router])

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-[calc(100svh-var(--navbar-height))] flex items-center justify-center">
        <p className="text-primary animate-pulse font-sentient text-xl">
          Checking authentication…
        </p>
      </div>
    )
  }

  return <>{children}</>
}
