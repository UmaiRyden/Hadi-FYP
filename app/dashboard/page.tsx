"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GL } from "@/components/gl"
import Link from "next/link"
import { uploadPcap } from "@/lib/api"

type AnalysisStatus = "idle" | "uploading-live" | "error"

export default function DashboardPage() {
  const router = useRouter()
  const [hovering, setHovering] = useState(false)
  const [status, setStatus] = useState<AnalysisStatus>("idle")
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === "dragenter" || e.type === "dragover")
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) setUploadedFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setUploadedFile(file)
  }

  const handleLiveAnalysis = async () => {
    if (!uploadedFile) return
    setStatus("uploading-live")
    setErrorMsg("")
    try {
      const { job_id } = await uploadPcap(uploadedFile)
      localStorage.setItem("job_id", String(job_id))
      router.push("/live")
    } catch (err: unknown) {
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Upload failed")
    }
  }

  const statusColor: Record<AnalysisStatus, string> = {
    idle:             "bg-foreground/20 text-foreground/60",
    "uploading-live": "bg-primary/20 text-primary",
    error:            "bg-red-500/20 text-red-400",
  }

  const statusLabel: Record<AnalysisStatus, string> = {
    idle:             "Idle",
    "uploading-live": "Uploading…",
    error:            "Error",
  }

  return (
    <div className="min-h-[calc(100svh-var(--navbar-height))] flex flex-col">
      <GL hovering={hovering} />

      <div className="relative z-10 page-container py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-sentient mb-4">
            Encrypted Mobile Traffic Classification
          </h1>
          <p className="text-foreground/60 text-base md:text-lg max-w-2xl mx-auto">
            Upload PCAP files to analyze encrypted Facebook, WhatsApp, YouTube and Instagram traffic
          </p>
        </div>

        <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)] mb-8 max-w-3xl mx-auto">
          <CardContent className="pt-8">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-all duration-300 cursor-pointer ${
                dragActive
                  ? "border-primary bg-primary/10 shadow-[0_0_30px_rgba(255,199,0,0.2)]"
                  : "border-primary/30 hover:border-primary/60 bg-background/50"
              }`}
            >
              <input
                type="file"
                accept=".pcap,.pcapng"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer block">
                <div className="mb-4">
                  <div className="text-4xl mb-2">📁</div>
                </div>
                <div className="text-xl font-sentient mb-2">
                  {uploadedFile ? uploadedFile.name : "Drop your PCAP file here"}
                </div>
                <div className="text-foreground/60 text-sm">
                  {uploadedFile ? (
                    <span>File selected · Click to change</span>
                  ) : (
                    <span>or click to browse · .pcap / .pcapng</span>
                  )}
                </div>
              </label>
            </div>

            {errorMsg && (
              <p className="mt-4 text-sm text-red-400 text-center">{errorMsg}</p>
            )}

            <div className="mt-8 flex flex-col gap-3">
              <Button
                onClick={handleLiveAnalysis}
                disabled={!uploadedFile || status === "uploading-live"}
                className="w-full bg-transparent border border-primary/40 text-primary hover:bg-primary/10"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                {status === "uploading-live" ? "Uploading…" : "[Run Analysis]"}
              </Button>

              <p className="text-foreground/30 text-xs text-center">
                Live Analysis streams confidence bars in real time as flows are classified
              </p>

              <div className="border-t border-primary/10 pt-3 mt-1">
                <Link href="/live-capture" className="block w-full">
                  <Button
                    className="w-full bg-transparent border border-primary/25 text-foreground/50 hover:border-primary/50 hover:text-primary/80"
                    onMouseEnter={() => setHovering(true)}
                    onMouseLeave={() => setHovering(false)}
                  >
                    [Live Capture →]
                  </Button>
                </Link>
                <p className="text-foreground/25 text-xs text-center mt-2">
                  Captures directly from your network interface — requires{" "}
                  <span className="font-mono text-foreground/40">live_agent.py</span> running locally
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="text-foreground/60 text-sm">Status:</span>
                <Badge className={`${statusColor[status]} border-0`}>
                  {statusLabel[status]}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
