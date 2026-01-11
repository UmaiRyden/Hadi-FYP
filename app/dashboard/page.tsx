"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GL } from "@/components/gl"

type AnalysisStatus = "idle" | "processing" | "completed"

export default function DashboardPage() {
  const [hovering, setHovering] = useState(false)
  const [status, setStatus] = useState<AnalysisStatus>("idle")
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      setUploadedFile(files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0])
    }
  }

  const handleRunAnalysis = () => {
    if (uploadedFile) {
      setStatus("processing")
      // Simulate processing time
      setTimeout(() => {
        setStatus("completed")
      }, 3000)
    }
  }

  const getStatusColor = (s: AnalysisStatus) => {
    switch (s) {
      case "idle":
        return "bg-foreground/20 text-foreground/60"
      case "processing":
        return "bg-primary/20 text-primary"
      case "completed":
        return "bg-green-500/20 text-green-400"
      default:
        return ""
    }
  }

  const getStatusLabel = (s: AnalysisStatus) => {
    switch (s) {
      case "idle":
        return "Idle"
      case "processing":
        return "Processing"
      case "completed":
        return "Completed"
      default:
        return ""
    }
  }

  return (
    <div className="min-h-svh flex flex-col">
      <GL hovering={hovering} />

      <div className="relative z-10 pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl sm:text-6xl font-sentient mb-4">Encrypted Mobile Traffic Classification</h1>
            <p className="text-foreground/60 text-lg max-w-2xl mx-auto">
              Upload PCAP files to analyze encrypted WhatsApp, YouTube and Instagram traffic
            </p>
          </div>

          {/* Upload Area */}
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)] mb-8">
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
                    {uploadedFile ? <span>File selected • Click to change</span> : <span>or click to browse</span>}
                  </div>
                </label>
              </div>

              {/* Analysis Button */}
              <div className="mt-8 flex flex-col gap-4">
                <Button
                  onClick={handleRunAnalysis}
                  disabled={!uploadedFile}
                  className="w-full"
                  onMouseEnter={() => !uploadedFile && setHovering(true)}
                  onMouseLeave={() => setHovering(false)}
                >
                  [Run Analysis]
                </Button>

                {/* Status Badge */}
                <div className="flex items-center justify-center gap-2">
                  <span className="text-foreground/60 text-sm">Status:</span>
                  <Badge className={`${getStatusColor(status)} border-0`}>{getStatusLabel(status)}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          {status === "completed" && (
            <div className="flex justify-center">
              <Link href="/processing">
                <Button className="px-8" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
                  [View Analysis]
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
