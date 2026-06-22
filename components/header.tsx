"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { MobileMenu } from "./mobile-menu"
import { useAuth } from "@/lib/auth-context"

export const Header = () => {
  const { user, isAuthenticated, loading, logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <div className="fixed top-0 left-0 w-full z-[1000] bg-gradient-to-b from-primary/5 via-transparent to-transparent backdrop-blur-3xl border-b border-primary/20 py-4 md:py-5 shadow-[0_1px_20px_rgba(255,199,0,0.1)]">
      <header className="flex items-center justify-between container">
        <Link href="/" className="flex items-center gap-3 -ml-2 md:-ml-4">
          <Image
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            className="w-10 h-10 md:w-12 md:h-12"
          />
          <span className="font-mono text-xl md:text-2xl font-semibold">
            <span className="text-primary">AI-Based</span>
            <span className="text-white ml-2">Traffic Classifier</span>
          </span>
        </Link>
        <nav className="flex max-lg:hidden absolute left-1/2 -translate-x-1/2 items-center justify-center gap-x-10">
          {[
            { label: "Upload PCAP", href: "/dashboard" },
            { label: "Results", href: "/result" },
            { label: "History", href: "/history" },
            { label: "Performance", href: "/performance" },
          ].map((item) => (
            <Link
              className="uppercase inline-block font-mono text-foreground/60 hover:text-primary duration-150 transition-colors ease-out relative group"
              href={item.href}
              key={item.label}
            >
              {item.label}
              <span className="absolute bottom-0 left-0 w-0 h-px bg-primary group-hover:w-full transition-all duration-300"></span>
            </Link>
          ))}
        </nav>
        {/* Auth area — hidden until auth state loads to avoid flicker */}
        {!loading && (
          isAuthenticated ? (
            <div className="flex items-center gap-5 max-lg:hidden">
              <span
                className="font-mono text-sm text-foreground/60 truncate max-w-[200px]"
                title={user?.email}
              >
                {user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="uppercase transition-colors ease-out duration-150 font-mono text-primary hover:text-primary/80"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              className="uppercase max-lg:hidden transition-colors ease-out duration-150 font-mono text-primary hover:text-primary/80"
              href="/login"
            >
              Sign In
            </Link>
          )
        )}
        <MobileMenu />
      </header>
    </div>
  )
}
