"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GL } from "@/components/gl"
import type { ClassifyResponse, DeviceResult, FlowResult } from "@/lib/api"
import { getStrength, STRENGTH_STYLE } from "@/lib/match-strength"

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

const FLOWS_PAGE = 20

export default function ResultPage() {
  const router  = useRouter()
  const [hovering, setHovering] = useState(false)
  const [result,   setResult]   = useState<ClassifyResponse | null>(null)
  const [filename, setFilename] = useState("")
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState("")
  const [showAllFlows,   setShowAllFlows]   = useState(false)
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null)

  useEffect(() => {
    const raw  = localStorage.getItem("classify_result")
    const name = localStorage.getItem("classify_filename") ?? ""
    if (!raw) {
      router.replace("/dashboard")
      return
    }
    try {
      setResult(JSON.parse(raw) as ClassifyResponse)
      setFilename(name)
    } catch {
      setError("Failed to parse result")
    } finally {
      setLoading(false)
    }
  }, [router])

  if (loading) {
    return (
      <div className="min-h-[calc(100svh-var(--navbar-height))] flex items-center justify-center">
        <p className="text-primary animate-pulse font-sentient text-xl">Loading result…</p>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="min-h-[calc(100svh-var(--navbar-height))] flex items-center justify-center">
        <p className="text-red-400 font-sentient text-xl">{error || "No result found"}</p>
      </div>
    )
  }

  const topColor  = APP_COLORS[result.predicted_app] ?? "#FFC700"
  const chartData = result.predictions.map((p) => ({
    name:       p.app,
    confidence: parseFloat(p.confidence.toFixed(1)),
  }))

  const displayedFlows: FlowResult[] = showAllFlows
    ? result.flows
    : result.flows.slice(0, FLOWS_PAGE)

  return (
    <div className="min-h-[calc(100svh-var(--navbar-height))] flex flex-col">
      <GL hovering={hovering} />

      <div className="relative z-10 page-container py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-sentient mb-4">
            Classification Result
          </h1>
          <p className="text-foreground/60 text-base md:text-lg">
            AI-powered traffic analysis complete
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-8">

          {/* ── Main result card ─────────────────────────────────────────── */}
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
                  {/* App icon circle */}
                  <div
                    className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-2xl font-bold text-white"
                    style={{ background: topColor }}
                  >
                    {APP_ICONS[result.predicted_app] ?? result.predicted_app[0]}
                  </div>

                  <div className="text-6xl font-sentient mb-4" style={{ color: topColor }}>
                    {result.predicted_app}
                  </div>

                  {(() => {
                    const strength = getStrength(result.confidence)
                    const s = STRENGTH_STYLE[strength]
                    return (
                      <Badge
                        className="text-lg px-6 py-2 border"
                        style={{ background: s.bg, color: s.text, borderColor: s.border }}
                      >
                        Match Strength: {strength}
                      </Badge>
                    )
                  })()}

                  {/* VPN indicator */}
                  <div className="mt-4">
                    <Badge
                      className="text-sm px-4 py-1.5 border font-mono"
                      style={result.vpn_detected ? {
                        background:  "rgba(239,68,68,0.15)",
                        color:       "#f87171",
                        borderColor: "rgba(239,68,68,0.4)",
                      } : {
                        background:  "rgba(34,197,94,0.12)",
                        color:       "#4ade80",
                        borderColor: "rgba(34,197,94,0.3)",
                      }}
                    >
                      {result.vpn_detected ? "⚠ VPN Detected" : "✓ No VPN Detected"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-primary/20">
                  <div>
                    <div className="text-foreground/60 text-sm uppercase tracking-wider mb-2">Flows</div>
                    <div className="text-4xl font-sentient">{result.flow_count.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-foreground/60 text-sm uppercase tracking-wider mb-2">Packets</div>
                    <div className="text-4xl font-sentient">{result.packet_count.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-foreground/60 text-sm uppercase tracking-wider mb-2">Time</div>
                    <div className="text-4xl font-sentient">{result.processing_time}s</div>
                  </div>
                </div>

                {filename && (
                  <p className="text-foreground/40 text-xs mt-4 truncate">{filename}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Confidence bar chart (Recharts) ──────────────────────────── */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)]">
            <CardContent className="pt-8">
              <p className="text-foreground/80 font-sentient text-lg mb-6">
                Confidence Distribution
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="rgba(255,255,255,0.07)"
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    stroke="rgba(255,255,255,0.3)"
                    fontSize={11}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="rgba(255,255,255,0.3)"
                    fontSize={11}
                    width={85}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`, "Confidence"]}
                    contentStyle={{
                      background:   "#0d0d0d",
                      border:       "1px solid rgba(255,199,0,0.3)",
                      borderRadius: "6px",
                      color:        "#fff",
                    }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Bar dataKey="confidence" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={APP_COLORS[entry.name] ?? "#FFC700"}
                        fillOpacity={entry.name === result.predicted_app ? 1 : 0.35}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Per-device breakdown ─────────────────────────────────────── */}
          {result.devices.length > 0 && (
            <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)]">
              <CardContent className="pt-8">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-foreground/80 font-sentient text-lg">
                    Per-Device Classification
                  </p>
                  <span className="text-foreground/40 text-sm">
                    {result.devices.length} device{result.devices.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-3 pb-2 border-b border-primary/10 text-foreground/40 text-xs uppercase tracking-wider">
                  <span>Source IP</span>
                  <span>Flows</span>
                  <span>Label</span>
                  <span className="text-right">Conf.</span>
                </div>

                <div className="space-y-1 mt-2">
                  {result.devices.map((device: DeviceResult) => {
                    const color    = APP_COLORS[device.predicted_app] ?? "#FFC700"
                    const expanded = expandedDevice === device.source_ip
                    return (
                      <div key={device.source_ip}>
                        <button
                          onClick={() => setExpandedDevice(expanded ? null : device.source_ip)}
                          className="w-full grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 items-center px-3 py-3 rounded-lg bg-background/40 hover:bg-primary/5 transition-colors text-left group"
                        >
                          <span className="text-sm font-mono text-foreground/70 group-hover:text-foreground/90 transition-colors flex items-center gap-2">
                            <span className="text-foreground/30 text-xs">{expanded ? "▼" : "▶"}</span>
                            {device.source_ip}
                          </span>
                          <span className="text-sm font-sentient text-foreground/60">
                            {device.flow_count}
                          </span>
                          <span className="text-sm font-mono font-semibold" style={{ color }}>
                            {device.predicted_app}
                          </span>
                          {(() => {
                            const strength = getStrength(device.confidence)
                            const s = STRENGTH_STYLE[strength]
                            return (
                              <span
                                className="text-xs font-mono font-semibold text-right"
                                style={{ color: s.text }}
                              >
                                {strength}
                              </span>
                            )
                          })()}
                        </button>

                        {/* Expanded: mini confidence bars per class */}
                        {expanded && (
                          <div className="mx-3 mb-2 px-4 py-3 rounded-b-lg bg-background/20 border border-primary/10 border-t-0 space-y-2">
                            {device.predictions.map((p) => {
                              const pColor = APP_COLORS[p.app] ?? "#FFC700"
                              return (
                                <div key={p.app}>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="font-mono text-foreground/50">{p.app}</span>
                                    <span className="font-sentient" style={{ color: pColor }}>
                                      {p.confidence.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{
                                        width:      `${p.confidence}%`,
                                        background: pColor,
                                        opacity:    p.app === device.predicted_app ? 1 : 0.4,
                                      }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Per-flow breakdown ────────────────────────────────────────── */}
          {result.flows.length > 0 && (
            <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)]">
              <CardContent className="pt-8">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-foreground/80 font-sentient text-lg">
                    Per-Flow Breakdown
                  </p>
                  <span className="text-foreground/40 text-sm">
                    {result.flows.length} flow{result.flows.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[2fr_1fr_auto_auto] gap-3 px-3 pb-2 border-b border-primary/10 text-foreground/40 text-xs uppercase tracking-wider">
                  <span>Flow</span>
                  <span>Label</span>
                  <span>Conf.</span>
                  <span>VPN</span>
                </div>

                <div className="space-y-1 mt-2 max-h-[420px] overflow-y-auto pr-1">
                  {displayedFlows.map((flow, i) => {
                    const color = APP_COLORS[flow.predicted_app] ?? "#FFC700"
                    const shortKey = flow.flow_key
                      .replace(/[()'"]/g, "")
                      .replace(/,\s*/g, " → ")
                      .replace(" → TCP", "")
                      .replace(" → UDP", "")
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-[2fr_1fr_auto_auto] gap-3 items-center px-3 py-2 rounded-lg bg-background/40 hover:bg-primary/5 transition-colors group"
                      >
                        <span
                          className="text-xs font-mono text-foreground/50 truncate group-hover:text-foreground/70 transition-colors"
                          title={flow.flow_key}
                        >
                          {shortKey}
                        </span>
                        <span
                          className="text-xs font-mono font-semibold"
                          style={{ color }}
                        >
                          {flow.predicted_app}
                        </span>
                        {(() => {
                          const strength = getStrength(flow.confidence)
                          const s = STRENGTH_STYLE[strength]
                          return (
                            <span
                              className="text-xs font-mono font-semibold w-14 text-right"
                              style={{ color: s.text }}
                            >
                              {strength}
                            </span>
                          )
                        })()}
                        <span
                          className="text-xs font-mono w-12 text-right"
                          style={{ color: flow.vpn_detected ? "#f87171" : "#4ade80" }}
                          title={flow.vpn_detected ? "VPN Detected" : "No VPN"}
                        >
                          {flow.vpn_detected ? "VPN" : "—"}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {result.flows.length > FLOWS_PAGE && (
                  <button
                    onClick={() => setShowAllFlows((v) => !v)}
                    className="mt-4 w-full text-center text-sm text-primary/60 hover:text-primary transition-colors py-2"
                  >
                    {showAllFlows
                      ? "Show fewer flows"
                      : `Show all ${result.flows.length} flows`}
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/performance">
              <Button
                variant="outline"
                className="border-primary/30 hover:bg-primary/10 px-8 w-full sm:w-auto"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                [View Performance Metrics]
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button
                className="px-8 w-full sm:w-auto"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                [Analyze Another File]
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
