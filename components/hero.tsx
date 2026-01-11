"use client"

import Link from "next/link"
import { GL } from "./gl"
import { Pill } from "./pill"
import { Button } from "./ui/button"
import { useState } from "react"

export function Hero() {
  const [hovering, setHovering] = useState(false)
  return (
    <div className="flex flex-col min-h-[calc(100svh-var(--navbar-height))] justify-center items-center px-4">
      <GL hovering={hovering} />

      <div className="text-center relative max-w-4xl mx-auto w-full">
        <Pill className="mb-8">AI-POWERED</Pill>
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-sentient text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] mb-6">
          Encrypted Mobile <br />
          <i className="font-light">Traffic Intelligence</i>
        </h1>
        <p className="font-mono text-sm sm:text-base md:text-lg text-foreground/90 text-balance mt-6 max-w-2xl mx-auto drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          AI-powered classification of encrypted WhatsApp, YouTube, and Instagram traffic without decryption.
        </p>

        <div className="mt-12">
          <Link className="contents max-sm:hidden" href="/dashboard">
            <Button className="px-8" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
              [Start Traffic Analysis]
            </Button>
          </Link>
          <Link className="contents sm:hidden" href="/dashboard">
            <Button
              size="sm"
              className="px-6"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              [Start Traffic Analysis]
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
