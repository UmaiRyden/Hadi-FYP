"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GL } from "@/components/gl"
import { getHistory, type HistoryItem } from "@/lib/api"
import { getStrength, STRENGTH_STYLE } from "@/lib/match-strength"
import { useAuth } from "@/lib/auth-context"

const APP_COLORS: Record<string, string> = {
  FACEBOOK:  "#1877F2",
  YOUTUBE:   "#FF0000",
  WHATSAPP:  "#25D366",
  INSTAGRAM: "#E1306C",
}

function formatDate(iso: string): string {
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year:   "numeric",
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  })
}

export default function HistoryPage() {
  const router = useRouter()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [items,   setItems]   = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")

  // Gate the page behind auth.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login")
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    let active = true
    getHistory()
      .then((data) => {
        if (active) setItems(data)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load history")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [authLoading, isAuthenticated])

  return (
    <div className="min-h-[calc(100svh-var(--navbar-height))] flex flex-col">
      <GL hovering={false} />

      <div className="relative z-10 page-container py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-sentient mb-4">
            Analysis History
          </h1>
          <p className="text-foreground/60 text-base md:text-lg">
            Your 10 most recent classifications
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)]">
            <CardContent className="pt-8 pb-4">
              {loading ? (
                <p className="text-primary animate-pulse font-sentient text-center py-12">
                  Loading history…
                </p>
              ) : error ? (
                <p className="text-red-400 text-center py-12">{error}</p>
              ) : items.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-foreground/60 mb-4">No analyses yet.</p>
                  <Link
                    href="/dashboard"
                    className="text-primary hover:text-primary/80 transition-colors underline"
                  >
                    Run your first analysis
                  </Link>
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div className="grid grid-cols-[2fr_1.2fr_1fr_0.7fr_1.3fr] gap-3 px-3 pb-3 border-b border-primary/10 text-foreground/40 text-xs uppercase tracking-wider">
                    <span>File</span>
                    <span>App</span>
                    <span>Match</span>
                    <span className="text-right">Flows</span>
                    <span className="text-right">Date</span>
                  </div>

                  <div className="space-y-1 mt-2">
                    {items.map((item) => {
                      const color    = APP_COLORS[item.predicted_app] ?? "#FFC700"
                      const strength = getStrength(item.confidence)
                      const s        = STRENGTH_STYLE[strength]
                      return (
                        <Link
                          key={item.id}
                          href={`/history/${item.id}`}
                          className="grid grid-cols-[2fr_1.2fr_1fr_0.7fr_1.3fr] gap-3 items-center px-3 py-3 rounded-lg bg-background/40 hover:bg-primary/5 transition-colors group"
                        >
                          <span
                            className="text-sm font-mono text-foreground/70 truncate group-hover:text-foreground/90 transition-colors"
                            title={item.original_filename}
                          >
                            {item.original_filename}
                          </span>
                          <span
                            className="text-sm font-mono font-semibold truncate"
                            style={{ color }}
                          >
                            {item.predicted_app}
                          </span>
                          <Badge
                            className="text-xs px-2 py-0.5 border w-fit"
                            style={{ background: s.bg, color: s.text, borderColor: s.border }}
                          >
                            {strength}
                          </Badge>
                          <span className="text-sm font-sentient text-foreground/60 text-right">
                            {item.flow_count.toLocaleString()}
                          </span>
                          <span className="text-xs text-foreground/50 text-right">
                            {formatDate(item.created_at)}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
