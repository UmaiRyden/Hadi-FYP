"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { GL } from "@/components/gl"
import { getResult, type AnalysisResult, type PredictionItem } from "@/lib/api"
import { getStrength, STRENGTH_STYLE } from "@/lib/match-strength"

// ── Constants ──────────────────────────────────────────────────────────────────

const CLASSES = ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "YOUTUBE"] as const

const APP_COLORS: Record<string, string> = {
  FACEBOOK:  "#1877F2",
  YOUTUBE:   "#FF0000",
  WHATSAPP:  "#25D366",
  INSTAGRAM: "#E1306C",
}

const STATUS_LABEL: Record<string, string> = {
  pending:     "Queued — waiting to start",
  parsing:     "Parsing PCAP packets…",
  extracting:  "Extracting 18 flow features…",
  classifying: "Running RandomForest classifier…",
  completed:   "Classification complete",
  failed:      "Analysis failed",
}

const STATUS_PROGRESS: Record<string, number> = {
  pending:     5,
  parsing:     25,
  extracting:  55,
  classifying: 82,
  completed:   100,
  failed:      0,
}

// Per-class growth rate per tick (adds realism — not equal speeds)
const GROWTH_RATES: Record<string, number> = {
  FACEBOOK:  2.2,
  INSTAGRAM: 1.1,
  WHATSAPP:  1.6,
  YOUTUBE:   1.9,
}
// Max value bars can reach while still pending (stays below 50 so real reveal is dramatic)
const MAX_PENDING = 47

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChartEntry { name: string; value: number }

// ── Custom tooltip ─────────────────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LivePage() {
  const router = useRouter()
  const [hovering,     setHovering]     = useState(false)
  const [jobStatus,    setJobStatus]    = useState<string>("pending")
  const [progress,     setProgress]     = useState(5)
  const [result,       setResult]       = useState<AnalysisResult | null>(null)
  const [chartData,    setChartData]    = useState<ChartEntry[]>(
    CLASSES.map(name => ({ name, value: 0 }))
  )
  // false during growth phase → no Recharts per-update animation (avoids jitter)
  // true only for the final reveal → smooth Recharts transition
  const [animateFinal, setAnimateFinal] = useState(false)

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const growRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef   = useRef(false)   // prevents stale-closure double-completion

  // ── Stop both intervals ────────────────────────────────────────────────────
  const stopAll = () => {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (growRef.current)  clearInterval(growRef.current)
  }

  // ── On completion: reveal real values ──────────────────────────────────────
  const revealResult = (predictions: PredictionItem[]) => {
    stopAll()
    // Sort to match CLASSES order so bar identity stays stable
    const predMap = Object.fromEntries(predictions.map(p => [p.app, p.confidence]))
    setAnimateFinal(true)
    setChartData(CLASSES.map(name => ({
      name,
      value: predMap[name] ?? 0,
    })))
  }

  // ── Bootstrap: read job_id, start polling + growth ─────────────────────────
  useEffect(() => {
    const jobId = parseInt(localStorage.getItem("job_id") ?? "0", 10)
    if (!jobId) { router.replace("/dashboard"); return }

    // ── Poll every 500ms ────────────────────────────────────────────────────
    const poll = async () => {
      try {
        const data = await getResult(jobId)
        setResult(data)
        setJobStatus(data.status)
        setProgress(STATUS_PROGRESS[data.status] ?? data.progress)

        if (data.status === "completed" && !doneRef.current) {
          doneRef.current = true
          if (data.predictions?.length) revealResult(data.predictions)
        }

        if (data.status === "failed" && !doneRef.current) {
          doneRef.current = true
          stopAll()
        }
      } catch {
        // network hiccup — keep polling
      }
    }

    poll()
    pollRef.current = setInterval(poll, 500)

    // ── Grow bars at 150ms — fast enough to look live ────────────────────────
    growRef.current = setInterval(() => {
      if (doneRef.current) return
      setChartData(prev =>
        prev.map(d => ({
          ...d,
          value: Math.min(
            d.value + Math.random() * (GROWTH_RATES[d.name] ?? 1.5),
            MAX_PENDING,
          ),
        }))
      )
    }, 150)

    return stopAll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isComplete = jobStatus === "completed"
  const isFailed   = jobStatus === "failed"
  const topApp     = result?.predicted_app
  const topColor   = APP_COLORS[topApp ?? ""] ?? "#FFC700"

  return (
    <div className="min-h-[calc(100svh-var(--navbar-height))] flex flex-col">
      <GL hovering={hovering} />

      <div className="relative z-10 page-container py-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-sentient mb-4">
            Live Analysis
          </h1>
          <p className="text-foreground/60 text-base md:text-lg">
            {isFailed
              ? "Analysis failed"
              : isComplete
                ? "Classification complete"
                : "Classifying encrypted traffic in real time…"}
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-8">

          {/* ── Progress card ──────────────────────────────────────────────── */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)]">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-mono text-foreground/60">
                  {STATUS_LABEL[jobStatus] ?? jobStatus}
                </span>
                <span className="text-sm font-sentient text-primary">
                  {progress}%
                </span>
              </div>
              <Progress value={progress} className="h-1.5 bg-foreground/10" />

              {/* Stage dots */}
              <div className="flex justify-between mt-4 px-1">
                {["parsing", "extracting", "classifying", "completed"].map((s, i) => {
                  const stages = ["parsing", "extracting", "classifying", "completed"]
                  const reached = stages.indexOf(jobStatus) >= i || isComplete
                  return (
                    <div key={s} className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-2 h-2 rounded-full transition-all duration-500 ${
                          reached ? "bg-primary scale-125" : "bg-foreground/20"
                        }`}
                      />
                      <span className={`text-[10px] font-mono uppercase tracking-wider ${
                        reached ? "text-primary/70" : "text-foreground/25"
                      }`}>
                        {s}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* ── Live confidence chart ───────────────────────────────────────── */}
          <Card
            className="border-primary/20 bg-background/95 backdrop-blur-sm overflow-hidden"
            style={{
              boxShadow: isComplete
                ? `0 0 30px ${topColor}33`
                : "0 0 20px rgba(255,199,0,0.08)",
              transition: "box-shadow 0.8s ease",
            }}
          >
            <CardContent className="pt-8 pb-8">
              <div className="flex items-center justify-between mb-6">
                <p className="text-foreground/80 font-sentient text-lg">
                  Confidence Distribution
                </p>
                {!isComplete && !isFailed && (
                  <span className="flex items-center gap-2 text-xs font-mono text-primary/60">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    live
                  </span>
                )}
                {isComplete && topApp && (() => {
                  const strength = getStrength(result!.confidence!)
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
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="rgba(255,255,255,0.2)"
                    fontSize={11}
                    width={90}
                    tickLine={false}
                  />
                  <Tooltip content={<LiveTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={animateFinal}
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v: number) => v > 0.5 ? `${v.toFixed(1)}%` : ""}
                      style={{ fontSize: 11, fill: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}
                    />
                    {chartData.map((entry) => {
                      const isWinner = isComplete && entry.name === topApp
                      const color    = APP_COLORS[entry.name] ?? "#FFC700"
                      return (
                        <Cell
                          key={entry.name}
                          fill={color}
                          fillOpacity={isComplete ? (isWinner ? 1 : 0.28) : 0.55}
                          style={{ transition: "fill-opacity 0.6s ease" }}
                        />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Scanning line while in progress */}
              {!isComplete && !isFailed && (
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

          {/* ── Result summary (shown on completion) ───────────────────────── */}
          {isComplete && result && (
            <Card
              className="border-primary/20 bg-background/95 backdrop-blur-sm"
              style={{ boxShadow: `0 0 20px ${topColor}22` }}
            >
              <CardContent className="pt-8 pb-8">
                <div className="text-center mb-8">
                  <p className="text-foreground/50 text-xs uppercase tracking-widest mb-3">
                    Predicted Application
                  </p>
                  <div className="text-5xl font-sentient mb-3" style={{ color: topColor }}>
                    {topApp}
                  </div>
                  {(() => {
                    const strength = getStrength(result.confidence!)
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
                    <p className="text-foreground/40 text-xs uppercase tracking-wider mb-1">Flows</p>
                    <p className="text-2xl font-sentient">{result.flow_count?.toLocaleString() ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-foreground/40 text-xs uppercase tracking-wider mb-1">Packets</p>
                    <p className="text-2xl font-sentient">{result.packet_count?.toLocaleString() ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-foreground/40 text-xs uppercase tracking-wider mb-1">Time</p>
                    <p className="text-2xl font-sentient">
                      {result.processing_time != null ? `${result.processing_time}s` : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Failed state ───────────────────────────────────────────────── */}
          {isFailed && (
            <Card className="border-red-500/20 bg-background/95">
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-red-400 font-sentient text-lg mb-2">Analysis Failed</p>
                <p className="text-foreground/40 text-sm mb-6">{result?.error_message ?? "Unknown error"}</p>
                <Button
                  className="border border-primary/30 bg-transparent text-primary hover:bg-primary/10 px-8"
                  onClick={() => router.replace("/dashboard")}
                  onMouseEnter={() => setHovering(true)}
                  onMouseLeave={() => setHovering(false)}
                >
                  [Try Again]
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── Actions ────────────────────────────────────────────────────── */}
          {isComplete && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/result">
                <Button
                  className="px-8 w-full sm:w-auto"
                  onMouseEnter={() => setHovering(true)}
                  onMouseLeave={() => setHovering(false)}
                >
                  [View Full Results]
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button
                  className="px-8 w-full sm:w-auto border border-primary/30 bg-transparent text-primary hover:bg-primary/10"
                  onMouseEnter={() => setHovering(true)}
                  onMouseLeave={() => setHovering(false)}
                >
                  [Analyze Another File]
                </Button>
              </Link>
            </div>
          )}

        </div>
      </div>

      {/* Keyframe for scanning line animation */}
      <style jsx>{`
        @keyframes scan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}
