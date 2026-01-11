"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GL } from "@/components/gl"

export default function ResultPage() {
  const [hovering, setHovering] = useState(false)

  const predictions = [
    { app: "WhatsApp", confidence: 94 },
    { app: "YouTube", confidence: 3 },
    { app: "Instagram", confidence: 3 },
  ]

  const topPrediction = predictions[0]

  return (
    <div className="min-h-svh flex flex-col">
      <GL hovering={hovering} />

      <div className="relative z-10 pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl sm:text-6xl font-sentient mb-4">Classification Result</h1>
            <p className="text-foreground/60">AI-powered traffic analysis complete</p>
          </div>

          {/* Main Result Card - Dominant Display */}
          <Card className="border-primary/30 bg-background/95 backdrop-blur-sm shadow-[0_0_40px_rgba(255,199,0,0.2)] mb-8 relative overflow-hidden">
            {/* Glow effect background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />

            <CardContent className="pt-12 pb-12 relative">
              <div className="text-center">
                <p className="text-foreground/60 uppercase tracking-widest text-sm mb-6">Predicted Application</p>

                {/* Large Result Display */}
                <div className="mb-10">
                  <div className="text-7xl font-sentient text-primary mb-4">{topPrediction.app}</div>
                  <div className="inline-block">
                    <Badge className="bg-primary/20 text-primary border-primary/40 text-lg px-6 py-2">
                      {topPrediction.confidence}% Confidence
                    </Badge>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-6 mt-12 pt-8 border-t border-primary/20">
                  <div>
                    <div className="text-foreground/60 text-sm uppercase tracking-wider mb-2">Total Flows</div>
                    <div className="text-4xl font-sentient">284</div>
                  </div>
                  <div>
                    <div className="text-foreground/60 text-sm uppercase tracking-wider mb-2">Processing Time</div>
                    <div className="text-4xl font-sentient">2.3s</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Classification Distribution */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)] mb-8">
            <CardContent className="pt-8">
              <div className="mb-6">
                <p className="text-foreground/80 font-sentient text-lg">Classification Distribution</p>
              </div>

              <div className="space-y-5">
                {predictions.map((pred, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-foreground/80 font-mono">{pred.app}</span>
                      <span className="text-primary font-sentient">{pred.confidence}%</span>
                    </div>
                    <div className="h-3 bg-foreground/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500"
                        style={{ width: `${pred.confidence}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/performance">
              <Button
                variant="default"
                className="px-8"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                [View Performance Metrics]
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button
                variant="default"
                className="px-8"
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
