"use client"

import Link from "next/link"
import { GL } from "./gl"
import { Pill } from "./pill"
import { Button } from "./ui/button"
import { useState } from "react"

export function Hero() {
  const [hovering, setHovering] = useState(false)
  return (
    <div className="flex flex-col h-svh justify-start">
      <GL hovering={hovering} />

      <div className="pt-24 sm:pt-32 md:pt-40 text-center relative">
        <Pill className="mb-6">AI-POWERED</Pill>
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-sentient text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          Encrypted Mobile <br />
          <i className="font-light">Traffic Intelligence</i>
        </h1>
        <p className="font-mono text-sm sm:text-base md:text-lg text-foreground/90 text-balance mt-8 max-w-[560px] mx-auto drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          AI-powered classification of encrypted WhatsApp, YouTube, and Instagram traffic without decryption.
        </p>

        <Link className="contents max-sm:hidden" href="/dashboard">
          <Button className="mt-14" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
            [Start Traffic Analysis]
          </Button>
        </Link>
        <Link className="contents sm:hidden" href="/dashboard">
          <Button
            size="sm"
            className="mt-14"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            [Start Traffic Analysis]
          </Button>
        </Link>
      </div>
    </div>
  )
}
