"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GL } from "@/components/gl"

export default function PerformancePage() {
  const [hovering, setHovering] = useState(false)

  const metrics = [
    { label: "Accuracy", value: "96.2%", color: "from-blue-500 to-blue-600" },
    { label: "Precision", value: "95.8%", color: "from-green-500 to-green-600" },
    { label: "Recall", value: "96.5%", color: "from-purple-500 to-purple-600" },
    { label: "F1-Score", value: "96.1%", color: "from-pink-500 to-pink-600" },
  ]

  const confusionMatrix = [
    { label: "WhatsApp", whatsapp: 1234, youtube: 45, instagram: 21 },
    { label: "YouTube", whatsapp: 38, youtube: 1198, instagram: 64 },
    { label: "Instagram", whatsapp: 29, youtube: 55, instagram: 1156 },
  ]

  return (
    <div className="min-h-svh flex flex-col">
      <GL hovering={hovering} />

      <div className="relative z-10 pt-32 pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl sm:text-6xl font-sentient mb-4">Model Performance</h1>
            <p className="text-foreground/60">Academic evaluation metrics for traffic classification</p>
          </div>

          {/* Performance Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {metrics.map((metric, idx) => (
              <Card
                key={idx}
                className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)]"
              >
                <CardContent className="pt-8 text-center">
                  <div className="text-foreground/60 text-sm uppercase tracking-wider mb-4">{metric.label}</div>
                  <div
                    className={`text-4xl font-sentient bg-gradient-to-r ${metric.color} bg-clip-text text-transparent`}
                  >
                    {metric.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Confusion Matrix */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)] mb-8">
            <CardContent className="pt-8">
              <div className="mb-8">
                <p className="text-foreground/80 font-sentient text-lg">Confusion Matrix</p>
                <p className="text-foreground/60 text-sm mt-2">True vs Predicted Classifications (test set)</p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-3 text-foreground/60 text-sm uppercase tracking-wider border-b border-primary/20">
                        Actual / Predicted
                      </th>
                      <th className="text-center px-4 py-3 text-foreground/60 text-sm uppercase tracking-wider border-b border-primary/20">
                        WhatsApp
                      </th>
                      <th className="text-center px-4 py-3 text-foreground/60 text-sm uppercase tracking-wider border-b border-primary/20">
                        YouTube
                      </th>
                      <th className="text-center px-4 py-3 text-foreground/60 text-sm uppercase tracking-wider border-b border-primary/20">
                        Instagram
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {confusionMatrix.map((row, idx) => (
                      <tr key={idx} className="border-b border-primary/10 hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-4 text-foreground/80 font-mono text-sm">{row.label}</td>
                        <td className="text-center px-4 py-4">
                          <div className="inline-block bg-green-500/20 text-green-400 px-3 py-1 rounded font-mono text-sm border border-green-500/30">
                            {row.whatsapp}
                          </div>
                        </td>
                        <td className="text-center px-4 py-4">
                          <div className="inline-block bg-primary/20 text-primary px-3 py-1 rounded font-mono text-sm border border-primary/30">
                            {row.youtube}
                          </div>
                        </td>
                        <td className="text-center px-4 py-4">
                          <div className="inline-block bg-red-500/20 text-red-400 px-3 py-1 rounded font-mono text-sm border border-red-500/30">
                            {row.instagram}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Dataset Information */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)] mb-8">
            <CardContent className="pt-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-foreground/60 text-sm uppercase tracking-wider mb-3">Training Samples</div>
                  <div className="text-3xl font-sentient">45,234</div>
                </div>
                <div>
                  <div className="text-foreground/60 text-sm uppercase tracking-wider mb-3">Test Samples</div>
                  <div className="text-3xl font-sentient">12,847</div>
                </div>
                <div>
                  <div className="text-foreground/60 text-sm uppercase tracking-wider mb-3">Total Features</div>
                  <div className="text-3xl font-sentient">12</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-center">
            <Link href="/result">
              <Button className="px-8" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
                [Back to Results]
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
