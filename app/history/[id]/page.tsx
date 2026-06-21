"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GL } from "@/components/gl"
import { getHistoryItem, type HistoryItem } from "@/lib/api"
import { getStrength, STRENGTH_STYLE } from "@/lib/match-strength"
import { useAuth } from "@/lib/auth-context"

const APP_COLORS: Record<string, string> = {
  FACEBOOK:  "#1877F2",
  YOUTUBE:   "#FF0000",
  WHATSAPP:  "#25D366",
  INSTAGRAM: "#E1306C",
}

const APP_ICONS: Record<string, string> = {
  FACEBOOK:  "f",
  YOUTUBE:   "▶",
  WHATSAPP:  "W",
  INSTAGRAM: "ig",
}

function formatDate(iso: string): string {
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function HistoryDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [hovering, setHovering] = useState(false)
  const [item,    setItem]    = useState<HistoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login")
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    const id = Number(params?.id)
    if (!Number.isFinite(id)) {
      setError("Invalid history id")
      setLoading(false)
      return
    }
    let active = true
    getHistoryItem(id)
      .then((data) => { if (active) setItem(data) })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load analysis")
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [authLoading, isAuthenticated, params?.id])

  if (loading) {
    return (
      <div className="min-h-[calc(100svh-var(--navbar-height))] flex items-center justify-center">
        <p className="text-primary animate-pulse font-sentient text-xl">Loading analysis…</p>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-[calc(100svh-var(--navbar-height))] flex flex-col items-center justify-center gap-6">
        <p className="text-red-400 font-sentient text-xl">{error || "Analysis not found"}</p>
        <Link href="/history">
          <Button>[Back to History]</Button>
        </Link>
      </div>
    )
  }

  const topColor = APP_COLORS[item.predicted_app] ?? "#FFC700"
  const strength = getStrength(item.confidence)
  const s        = STRENGTH_STYLE[strength]

  return (
    <div className="min-h-[calc(100svh-var(--navbar-height))] flex flex-col">
      <GL hovering={hovering} />

      <div className="relative z-10 page-container py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-sentient mb-4">
            Saved Analysis
          </h1>
          <p className="text-foreground/60 text-base md:text-lg">
            {formatDate(item.created_at)}
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-8">
          <Card
            className="border-primary/30 bg-background/95 backdrop-blur-sm relative overflow-hidden"
            style={{ boxShadow: `0 0 40px ${topColor}33` }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
            <CardContent className="pt-12 pb-12 relative">
              <div className="text-center">
                <p className="text-foreground/60 uppercase tracking-widest text-sm mb-6">
                  Predicted Application
                </p>

                <div className="mb-10">
                  <div
                    className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-2xl font-bold text-white"
                    style={{ background: topColor }}
                  >
                    {APP_ICONS[item.predicted_app] ?? item.predicted_app[0]}
                  </div>

                  <div className="text-6xl font-sentient mb-4" style={{ color: topColor }}>
                    {item.predicted_app}
                  </div>

                  <Badge
                    className="text-lg px-6 py-2 border"
                    style={{ background: s.bg, color: s.text, borderColor: s.border }}
                  >
                    Match Strength: {strength}
                  </Badge>

                  <div className="mt-4">
                    <Badge
                      className="text-sm px-4 py-1.5 border font-mono"
                      style={item.vpn_detected ? {
                        background:  "rgba(239,68,68,0.15)",
                        color:       "#f87171",
                        borderColor: "rgba(239,68,68,0.4)",
                      } : {
                        background:  "rgba(34,197,94,0.12)",
                        color:       "#4ade80",
                        borderColor: "rgba(34,197,94,0.3)",
                      }}
                    >
                      {item.vpn_detected ? "⚠ VPN Detected" : "✓ No VPN Detected"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mt-12 pt-8 border-t border-primary/20">
                  <div>
                    <div className="text-foreground/60 text-sm uppercase tracking-wider mb-2">Flows</div>
                    <div className="text-4xl font-sentient">{item.flow_count.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-foreground/60 text-sm uppercase tracking-wider mb-2">Packets</div>
                    <div className="text-4xl font-sentient">{item.packet_count.toLocaleString()}</div>
                  </div>
                </div>

                <p className="text-foreground/40 text-xs mt-4 truncate">{item.original_filename}</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-4">
            <Link href="/history">
              <Button
                className="px-8"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                [Back to History]
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button className="px-8">[Analyze New File]</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
