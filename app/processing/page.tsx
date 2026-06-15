"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { GL } from "@/components/gl"
import { getClassifyPromise, getClassifyFilename, clearClassify } from "@/lib/classify-store"
import type { ClassifyResponse } from "@/lib/api"

const STAGES = [
  { label: "Parsing PCAP packets",            progress: 25 },
  { label: "Grouping packets into flows",      progress: 50 },
  { label: "Extracting 18 flow features",      progress: 75 },
  { label: "Running RandomForest classifier",  progress: 95 },
]

export default function ProcessingPage() {
  const router    = useRouter()
  const [hovering, setHovering] = useState(false)
  const [stage,    setStage]    = useState(0)   // 0-3 in progress, 4 = done, -1 = failed
  const [result,   setResult]   = useState<ClassifyResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const filename = getClassifyFilename()

  const displayProgress =
    stage === 4  ? 100 :
    stage === -1 ? 0   :
    STAGES[stage]?.progress ?? 0

  useEffect(() => {
    const promise = getClassifyPromise()
    if (!promise) {
      router.replace("/dashboard")
      return
    }

    // Advance through stages 0 → 1 → 2 → 3 on a timer (stops at 3 until API responds)
    timersRef.current = [
      setTimeout(() => setStage(1), 1400),
      setTimeout(() => setStage(2), 2900),
      setTimeout(() => setStage(3), 4400),
    ]

    promise
      .then((data) => {
        localStorage.setItem("classify_result",   JSON.stringify(data))
        localStorage.setItem("classify_filename",  filename)
        setResult(data)
        setStage(4)
        clearClassify()
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : "Analysis failed")
        setStage(-1)
        clearClassify()
      })

    return () => timersRef.current.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-[calc(100svh-var(--navbar-height))] flex flex-col">
      <GL hovering={hovering} />

      <div className="relative z-10 page-container py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-sentient mb-4">
            Feature Extraction
          </h1>
          <p className="text-foreground/60 text-base md:text-lg">
            Analyzing encrypted traffic…
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* File / result info */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)] mb-8">
            <CardContent className="pt-8">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-foreground/60 text-sm uppercase tracking-wider">PCAP File</div>
                  <div className="text-xl font-sentient mt-2 truncate" title={filename}>
                    {filename || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-foreground/60 text-sm uppercase tracking-wider">Packets</div>
                  <div className="text-2xl font-sentient mt-2">
                    {result ? result.packet_count.toLocaleString() : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-foreground/60 text-sm uppercase tracking-wider">Flows</div>
                  <div className="text-2xl font-sentient mt-2">
                    {result ? result.flow_count.toLocaleString() : "—"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress bar */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)] mb-8">
            <CardContent className="pt-8">
              <div className="mb-8">
                <div className="text-primary font-sentient text-lg mb-4">
                  Feature Extraction Progress
                </div>
                <Progress value={displayProgress} className="h-2 bg-foreground/10" />
                <div className="text-foreground/60 text-sm mt-2">
                  {stage === 4 ? "100% Complete" : `${displayProgress}% Complete`}
                </div>
              </div>

              {/* Stage checklist */}
              <div className="space-y-4">
                {STAGES.map(({ label }, i) => {
                  const done    = stage === 4 || i < stage
                  const active  = stage !== 4 && i === stage
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-primary/20"
                    >
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-all ${
                          done
                            ? "bg-green-500/30 border border-green-500/60"
                            : active
                              ? "bg-primary/30 border border-primary/60"
                              : "bg-primary/20 border border-primary/40"
                        }`}
                      >
                        {done
                          ? <span className="text-green-400 text-sm font-bold">✓</span>
                          : active
                            ? <span className="text-primary text-xs animate-pulse">●</span>
                            : null}
                      </div>
                      <span
                        className={`text-sm font-mono transition-all ${
                          done
                            ? "text-foreground/60 line-through"
                            : active
                              ? "text-primary"
                              : "text-foreground/40"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <div className="text-center mb-8">
            {stage === -1 ? (
              <p className="text-red-400 font-sentient text-lg">
                Analysis failed: {errorMsg}
              </p>
            ) : stage === 4 ? (
              <p className="text-green-400 font-sentient text-lg">
                Analysis complete — {result!.flow_count} flows classified in {result!.processing_time}s
              </p>
            ) : (
              <p className="text-primary font-sentient text-lg animate-pulse">
                {STAGES[stage]?.label}…
              </p>
            )}
          </div>

          {stage === 4 && (
            <div className="flex justify-center">
              <Button
                className="px-8"
                onClick={() => router.push("/result")}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                [View Results]
              </Button>
            </div>
          )}

          {stage === -1 && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="border-primary/30 hover:bg-primary/10 px-8"
                onClick={() => router.replace("/dashboard")}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                [Try Again]
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
