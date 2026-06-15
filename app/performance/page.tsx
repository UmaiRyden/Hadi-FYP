"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GL } from "@/components/gl"
import { getPerformance, type PerformanceMetrics } from "@/lib/api"

const METRIC_STYLES = [
  { label: "Accuracy",  key: "accuracy",  color: "from-blue-500 to-blue-600"   },
  { label: "Precision", key: "precision", color: "from-green-500 to-green-600" },
  { label: "Recall",    key: "recall",    color: "from-purple-500 to-purple-600"},
  { label: "F1-Score",  key: "f1_score",  color: "from-pink-500 to-pink-600"   },
] as const

// Diagonal cells (correct predictions) get green; others get the standard colour
function cellStyle(rowIdx: number, colIdx: number) {
  if (rowIdx === colIdx) return "bg-green-500/20 text-green-400 border-green-500/30"
  return "bg-primary/20 text-primary border-primary/30"
}

export default function PerformancePage() {
  const [hovering, setHovering] = useState(false)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    getPerformance()
      .then(setMetrics)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load metrics")
      )
  }, [])

  return (
    <div className="min-h-[calc(100svh-var(--navbar-height))] flex flex-col">
      <GL hovering={hovering} />

      <div className="relative z-10 page-container py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-sentient mb-4">
            Model Performance
          </h1>
          <p className="text-foreground/60 text-base md:text-lg">
            Academic evaluation metrics for traffic classification
          </p>
        </div>

        {error && (
          <p className="text-center text-red-400 mb-8">{error}</p>
        )}

        <div className="max-w-5xl mx-auto">
          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {METRIC_STYLES.map(({ label, key, color }) => (
              <Card
                key={key}
                className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)]"
              >
                <CardContent className="pt-8 text-center">
                  <div className="text-foreground/60 text-sm uppercase tracking-wider mb-4">
                    {label}
                  </div>
                  <div
                    className={`text-4xl font-sentient bg-gradient-to-r ${color} bg-clip-text text-transparent`}
                  >
                    {metrics ? `${metrics[key]}%` : "—"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Confusion Matrix */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)] mb-8">
            <CardContent className="pt-8">
              <div className="mb-8">
                <p className="text-primary font-sentient text-lg">Confusion Matrix</p>
                <p className="text-foreground/60 text-sm mt-2">
                  True vs Predicted Classifications (test set)
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-3 text-foreground/60 text-sm uppercase tracking-wider border-b border-primary/20">
                        Actual / Predicted
                      </th>
                      {(metrics?.confusion_matrix.labels ?? ["WhatsApp", "YouTube", "Instagram"]).map(
                        (lbl) => (
                          <th
                            key={lbl}
                            className="text-center px-4 py-3 text-foreground/60 text-sm uppercase tracking-wider border-b border-primary/20"
                          >
                            {lbl}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics?.confusion_matrix.labels.map((rowLabel, ri) => (
                      <tr
                        key={rowLabel}
                        className="border-b border-primary/10 hover:bg-primary/5 transition-colors"
                      >
                        <td className="px-4 py-4 text-foreground/80 font-mono text-sm">
                          {rowLabel}
                        </td>
                        {metrics.confusion_matrix.matrix[ri].map((val, ci) => (
                          <td key={ci} className="text-center px-4 py-4">
                            <div
                              className={`inline-block px-3 py-1 rounded font-mono text-sm border ${cellStyle(ri, ci)}`}
                            >
                              {val}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Dataset info */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)] mb-8">
            <CardContent className="pt-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-foreground/60 text-sm uppercase tracking-wider mb-3">
                    Training Samples
                  </div>
                  <div className="text-3xl font-sentient">
                    {metrics?.training_samples.toLocaleString() ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-foreground/60 text-sm uppercase tracking-wider mb-3">
                    Test Samples
                  </div>
                  <div className="text-3xl font-sentient">
                    {metrics?.test_samples.toLocaleString() ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-foreground/60 text-sm uppercase tracking-wider mb-3">
                    Total Features
                  </div>
                  <div className="text-3xl font-sentient">
                    {metrics?.feature_count ?? "—"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Link href="/result">
              <Button
                className="px-8"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                [Back to Results]
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
