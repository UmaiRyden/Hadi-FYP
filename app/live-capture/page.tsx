"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GL } from "@/components/gl"
import { getStrength, STRENGTH_STYLE } from "@/lib/match-strength"

// ── Constants ──────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const WS_BASE  = API_BASE.replace(/^http/, "ws")

const CLASSES = ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "YOUTUBE"] as const

const APP_COLORS: Record<string, string> = {
  FACEBOOK:  "#1877F2",
  YOUTUBE:   "#FF0000",
  WHATSAPP:  "#25D366",
  INSTAGRAM: "#E1306C",
}

// ── Types ──────────────────────────────────────────────────────────────────

interface PredictionItem {
  app: string
  confidence: number
}

interface ChartEntry {
  name: string
  value: number
}

interface LiveResult {
  predicted_app: string
  confidence: number
  flow_count: number
  total_flows: number
  vpn_detected: boolean
  predictions: PredictionItem[]
}

// ── Custom tooltip ─────────────────────────────────────────────────────────

function LiveTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartEntry }[] }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0].payload
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs font-mono"
      style={{
        background:   "#0d0d0d",
        border:       `1px solid ${APP_COLORS[name] ?? "#FFC700"}55`,
        color:        "#fff",
      }}
    >
      <span style={{ color: APP_COLORS[name] ?? "#FFC700" }}>{name}</span>
      <span className="ml-3 text-foreground/70">{value.toFixed(1)}%</span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LiveCapturePage() {
  const [hovering,       setHovering]       = useState(false)
  const [capturing,      setCapturing]      = useState(false)
  const [agentConnected, setAgentConnected] = useState(false)
  const [totalFlows,     setTotalFlows]     = useState(0)
  const [vpnDetected,    setVpnDetected]    = useState(false)
  const [latestResult,   setLatestResult]   = useState<LiveResult | null>(null)
  const [error,          setError]          = useState<string | null>(null)
  const [chartData,      setChartData]      = useState<ChartEntry[]>(
    CLASSES.map(name => ({ name, value: 0 }))
  )

  const wsRef = useRef<WebSocket | null>(null)

  const startCapture = () => {
    setError(null)
    const ws = new WebSocket(`${WS_BASE}/ws/capture`)
    wsRef.current = ws

    ws.onopen = () => setCapturing(true)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)

        if (msg.type === "status") {
          setAgentConnected(msg.agent_connected as boolean)
          setTotalFlows(msg.total_flows as number)
        } else if (msg.type === "result") {
          const r = msg as LiveResult & { type: string }
          setLatestResult(r)
          setTotalFlows(r.total_flows)
          setVpnDetected(r.vpn_detected)

          const predMap = Object.fromEntries(
            (r.predictions ?? []).map(p => [p.app, p.confidence])
          )
          setChartData(CLASSES.map(name => ({ name, value: predMap[name] ?? 0 })))
        }
      } catch {
        // malformed message — ignore
      }
    }

    ws.onclose = () => {
      setCapturing(false)
      setAgentConnected(false)
      wsRef.current = null
    }

    ws.onerror = () => {
      setError("Could not connect to backend. Make sure FastAPI is running on port 8000.")
      setCapturing(false)
      wsRef.current = null
    }
  }

  const stopCapture = () => {
    wsRef.current?.close()
    wsRef.current = null
    setCapturing(false)
    setAgentConnected(false)
  }

  // Close WS on unmount
  useEffect(() => () => wsRef.current?.close(), [])

  const topApp   = latestResult?.predicted_app
  const topColor = APP_COLORS[topApp ?? ""] ?? "#FFC700"

  return (
    <div className="min-h-[calc(100svh-var(--navbar-height))] flex flex-col">
      <GL hovering={hovering} />

      <div className="relative z-10 page-container py-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-sentient mb-4">
            Live Capture
          </h1>
          <p className="text-foreground/60 text-base md:text-lg">
            Real-time encrypted traffic classification from your network interface
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-8">

          {/* ── Agent note ─────────────────────────────────────────────────── */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg px-5 py-4 text-sm font-mono text-foreground/50 leading-relaxed">
            <span className="text-primary/80 font-semibold">SETUP REQUIRED:</span>{" "}
            Run{" "}
            <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              python backend/live_agent.py
            </span>{" "}
            on this machine before starting capture. Requires{" "}
            <span className="text-foreground/70">Npcap</span> (Windows) or{" "}
            <span className="text-foreground/70">root</span> (Linux / Mac).
          </div>

          {/* ── Control card ───────────────────────────────────────────────── */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)]">
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col sm:flex-row items-center gap-6">

                {/* Status indicators */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-foreground/50 text-xs font-mono uppercase tracking-wider w-24">
                      Backend
                    </span>
                    <Badge className={
                      capturing
                        ? "bg-green-500/20 text-green-400 border-green-500/30 border"
                        : "bg-foreground/10 text-foreground/40 border-foreground/20 border"
                    }>
                      {capturing ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-foreground/50 text-xs font-mono uppercase tracking-wider w-24">
                      Agent
                    </span>
                    <Badge className={
                      agentConnected
                        ? "bg-primary/20 text-primary border-primary/30 border"
                        : "bg-foreground/10 text-foreground/40 border-foreground/20 border"
                    }>
                      {agentConnected
                        ? "Streaming"
                        : capturing ? "Waiting…" : "Not running"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-foreground/50 text-xs font-mono uppercase tracking-wider w-24">
                      Flows seen
                    </span>
                    <span className="font-sentient text-primary text-lg">
                      {totalFlows.toLocaleString()}
                    </span>
                  </div>

                  {vpnDetected && (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 border">
                      VPN Detected
                    </Badge>
                  )}
                </div>

                {/* Start / Stop */}
                <div>
                  {!capturing ? (
                    <Button
                      onClick={startCapture}
                      className="px-10"
                      onMouseEnter={() => setHovering(true)}
                      onMouseLeave={() => setHovering(false)}
                    >
                      [Start Capture]
                    </Button>
                  ) : (
                    <Button
                      onClick={stopCapture}
                      className="px-10 bg-transparent border border-red-500/40 text-red-400 hover:bg-red-500/10"
                      onMouseEnter={() => setHovering(true)}
                      onMouseLeave={() => setHovering(false)}
                    >
                      [Stop Capture]
                    </Button>
                  )}
                </div>
              </div>

              {error && (
                <p className="mt-5 text-sm text-red-400 font-mono text-center">{error}</p>
              )}
            </CardContent>
          </Card>

          {/* ── Live confidence chart ───────────────────────────────────────── */}
          <Card
            className="border-primary/20 bg-background/95 backdrop-blur-sm overflow-hidden"
            style={{
              boxShadow: agentConnected
                ? `0 0 30px ${topColor}33`
                : "0 0 20px rgba(255,199,0,0.08)",
              transition: "box-shadow 0.8s ease",
            }}
          >
            <CardContent className="pt-8 pb-8">
              <div className="flex items-center justify-between mb-6">
                <p className="text-primary font-sentient text-lg">
                  Confidence Distribution
                </p>

                {agentConnected && (
                  <span className="flex items-center gap-2 text-xs font-mono text-primary/60">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    live
                  </span>
                )}

                {topApp && (() => {
                  const strength = getStrength(latestResult!.confidence)
                  const s = STRENGTH_STYLE[strength]
                  return (
                    <Badge
                      className="text-sm px-3 py-1 border font-mono"
                      style={{ background: s.bg, color: s.text, borderColor: s.border }}
                    >
                      {topApp} · {strength}
                    </Badge>
                  )
                })()}
              </div>

              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={v => `${v}%`}
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: "rgba(255,255,255,0.6)" }}
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: "rgba(255,255,255,0.9)" }}
                    fontSize={11}
                    width={90}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<LiveTooltip />}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={true}
                    animationDuration={600}
                    animationEasing="ease-out"
                  >
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v: number) => v > 0.5 ? `${v.toFixed(1)}%` : ""}
                      style={{ fontSize: 11, fill: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}
                    />
                    {chartData.map((entry) => {
                      const isWinner = entry.name === topApp
                      const color    = APP_COLORS[entry.name] ?? "#FFC700"
                      return (
                        <Cell
                          key={entry.name}
                          fill={color}
                          fillOpacity={topApp ? (isWinner ? 1 : 0.28) : 0.45}
                          style={{ transition: "fill-opacity 0.6s ease" }}
                        />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Scanning line while agent is active */}
              {agentConnected && (
                <div className="relative h-px mt-2 overflow-hidden rounded-full bg-foreground/5">
                  <div
                    className="absolute top-0 left-0 h-full w-1/3 rounded-full"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(255,199,0,0.5), transparent)",
                      animation:  "scan 1.8s ease-in-out infinite",
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Latest result summary ───────────────────────────────────────── */}
          {latestResult && (
            <Card
              className="border-primary/20 bg-background/95 backdrop-blur-sm"
              style={{ boxShadow: `0 0 20px ${topColor}22` }}
            >
              <CardContent className="pt-8 pb-8">
                <div className="text-center mb-8">
                  <p className="text-foreground/50 text-xs uppercase tracking-widest mb-3">
                    Current Prediction
                  </p>
                  <div
                    className="text-5xl font-sentient mb-3"
                    style={{ color: topColor }}
                  >
                    {topApp}
                  </div>
                  {(() => {
                    const strength = getStrength(latestResult.confidence)
                    const s = STRENGTH_STYLE[strength]
                    return (
                      <Badge
                        className="text-base px-5 py-1.5 border"
                        style={{ background: s.bg, color: s.text, borderColor: s.border }}
                      >
                        Match Strength: {strength}
                      </Badge>
                    )
                  })()}
                </div>

                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-primary/15 text-center">
                  <div>
                    <p className="text-foreground/40 text-xs uppercase tracking-wider mb-1">
                      This Batch
                    </p>
                    <p className="text-2xl font-sentient">
                      {latestResult.flow_count.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground/40 text-xs uppercase tracking-wider mb-1">
                      Total Flows
                    </p>
                    <p className="text-2xl font-sentient">
                      {totalFlows.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground/40 text-xs uppercase tracking-wider mb-1">
                      VPN
                    </p>
                    <p
                      className="text-2xl font-sentient"
                      style={{ color: vpnDetected ? "#f97316" : "inherit" }}
                    >
                      {vpnDetected ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Back link ───────────────────────────────────────────────────── */}
          <div className="flex justify-center">
            <Link href="/dashboard">
              <Button
                className="border border-primary/30 bg-transparent text-primary hover:bg-primary/10 px-8"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                [Back to Dashboard]
              </Button>
            </Link>
          </div>

        </div>
      </div>

      <style jsx>{`
        @keyframes scan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}
