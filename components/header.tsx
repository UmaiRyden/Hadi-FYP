import Link from "next/link"
import Image from "next/image"
import { MobileMenu } from "./mobile-menu"

export const Header = () => {
  return (
    <div className="fixed top-0 left-0 w-full z-[1000] bg-black/40 backdrop-blur-2xl border-b border-white/5 py-4 md:py-5">
      <header className="flex items-center justify-between container">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            className="w-10 h-10 md:w-12 md:h-12"
          />
          <span className="font-mono text-xl md:text-2xl font-semibold text-white">FYP</span>
        </Link>
        <nav className="flex max-lg:hidden absolute left-1/2 -translate-x-1/2 items-center justify-center gap-x-10">
          {[
            { label: "Upload PCAP", href: "/dashboard" },
            { label: "Results", href: "/result" },
            { label: "Performance", href: "/performance" },
          ].map((item) => (
            <Link
              className="uppercase inline-block font-mono text-foreground/60 hover:text-foreground/100 duration-150 transition-colors ease-out"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          className="uppercase max-lg:hidden transition-colors ease-out duration-150 font-mono text-primary hover:text-primary/80"
          href="/login"
        >
          Sign In
        </Link>
        <MobileMenu />
      </header>
    </div>
  )
}
