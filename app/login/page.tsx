"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { GL } from "@/components/gl"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [hovering, setHovering] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle login logic here
    console.log("Login attempt:", { email, password })
  }

  return (
    <div className="flex flex-col min-h-[calc(100svh-var(--navbar-height))] justify-center items-center px-4">
      <GL hovering={hovering} />

      <div className="relative z-10 w-full max-w-md">
        <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-[0_0_20px_rgba(255,199,0,0.1)]">
          <CardHeader className="text-center pb-6 pt-8">
            <CardTitle className="text-2xl md:text-3xl font-sentient mb-2">Sign in to Traffic Intelligence Platform</CardTitle>
            <CardDescription className="text-foreground/60">
              Enter your credentials to access the system
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground/80">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/50 border-primary/30 focus-visible:border-primary/60 text-foreground placeholder:text-foreground/40"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground/80">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background/50 border-primary/30 focus-visible:border-primary/60 text-foreground placeholder:text-foreground/40"
                  required
                />
              </div>

              {/* Sign In Button */}
              <Button
                type="submit"
                className="w-full mt-8"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                [Sign In]
              </Button>
            </form>

            {/* Sign Up Link */}
            <div className="mt-6 text-center text-foreground/60 text-sm">
              Don't have an account?{" "}
              <Link href="/signup" className="text-primary hover:text-primary/80 transition-colors underline">
                Create new account
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
