"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { GL } from "@/components/gl"

interface ExtractionStep {
  name: string
  completed: boolean
}

export default function ProcessingPage() {
  const [hovering, setHovering] = useState(false)
  const [progress, setProgress] = useState(0)
  const [steps, setSteps] = useState<ExtractionStep[]>([
    { name: "Packet size", completed: false },
    { name: "Packet timing", completed: false },
    { name: "Flow duration", completed: false },
    { name: "Upload/download ratio", completed: false },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        const newProgress = prev + Math.random() * 25
        return Math.min(newProgress, 100)
      })
    }, 600)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const stepsCompleted = Math.floor((progress / 100) * steps.length)
    setSteps((prevSteps) =>
      prevSteps.map((step, index) => ({
        ...step,
        completed: index < stepsCompleted,
      })),
    )
  }, [progress])

  return (
    <div className="min-h-svh flex flex-col">
      <GL hovering={hovering} />

      <div className="relative z-10 pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl sm:text-6xl font-sentient mb-4">Feature Extraction</h1>
            <p className="text-foreground/60">Analyzing encrypted traffic...</p>
          </div>

          {/* PCAP File Info Card */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)] mb-8">
            <CardContent className="pt-8">
              <div className="grid grid-cols-3 gap-6 text-center mb-8">
                <div>
                  <div className="text-foreground/60 text-sm uppercase tracking-wider">PCAP File</div>
                  <div className="text-2xl font-sentient mt-2">traffic.pcap</div>
                </div>
                <div>
                  <div className="text-foreground/60 text-sm uppercase tracking-wider">Packets</div>
                  <div className="text-2xl font-sentient mt-2">12,547</div>
                </div>
                <div>
                  <div className="text-foreground/60 text-sm uppercase tracking-wider">Flows</div>
                  <div className="text-2xl font-sentient mt-2">284</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature Extraction Checklist */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)] mb-8">
            <CardContent className="pt-8">
              <div className="mb-8">
                <div className="text-foreground/80 font-sentient text-lg mb-4">Feature Extraction Progress</div>
                <Progress value={progress} className="h-2 bg-foreground/10" />
                <div className="text-foreground/60 text-sm mt-2">{Math.round(progress)}% Complete</div>
              </div>

              {/* Checklist Items */}
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-primary/20"
                  >
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-all ${
                        step.completed
                          ? "bg-green-500/30 border border-green-500/60"
                          : "bg-primary/20 border border-primary/40"
                      }`}
                    >
                      {step.completed && <span className="text-green-400 text-sm font-bold">✓</span>}
                    </div>
                    <span
                      className={`text-sm font-mono ${step.completed ? "text-foreground/60 line-through" : "text-foreground/80"}`}
                    >
                      {step.name}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <div className="text-center mb-8">
            <p className="text-primary font-sentient text-lg animate-pulse">Analyzing encrypted traffic...</p>
          </div>

          {/* Navigation */}
          {progress >= 100 && (
            <div className="flex justify-center">
              <Link href="/result">
                <Button className="px-8" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
                  [View Results]
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
