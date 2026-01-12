'use client'

import { Hero } from "@/components/hero";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  Shield, 
  Brain, 
  CheckCircle2, 
  Activity, 
  Clock, 
  TrendingUp,
  Lock,
  Database,
  Zap
} from "lucide-react";

export default function Home() {
  return (
    <>
      <Hero />
      
      {/* Section 1 - How It Works */}
      <section className="relative py-24 px-4">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-sentient text-white mb-4">
              How It <i className="font-light">Works</i>
            </h2>
            <p className="font-mono text-foreground/70 text-sm md:text-base max-w-2xl mx-auto">
              Four simple steps to analyze encrypted traffic with AI
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Upload,
                title: "Upload PCAP",
                description: "Import your network capture file"
              },
              {
                icon: Database,
                title: "Extract Features",
                description: "Analyze encrypted traffic patterns"
              },
              {
                icon: Brain,
                title: "AI Analysis",
                description: "Machine learning model processes data"
              },
              {
                icon: CheckCircle2,
                title: "Classification",
                description: "Application identified with confidence"
              }
            ].map((step, index) => (
              <div 
                key={index}
                className="relative group bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-6 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,199,0,0.2)]"
              >
                <div className="absolute top-4 right-4 text-primary/20 font-mono text-sm">
                  0{index + 1}
                </div>
                <div className="mb-4 text-primary">
                  <step.icon className="w-10 h-10" strokeWidth={1.5} />
                </div>
                <h3 className="font-mono text-lg text-white mb-2">{step.title}</h3>
                <p className="font-mono text-sm text-foreground/60">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2 - Why Encrypted Traffic Can Be Classified */}
      <section className="relative py-24 px-4">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-sentient text-white mb-4">
              Why It's <i className="font-light">Possible</i>
            </h2>
            <p className="font-mono text-foreground/70 text-sm md:text-base max-w-2xl mx-auto">
              Classification without decryption using behavioral patterns
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Activity,
                title: "Packet Size Patterns",
                description: "Different applications create unique packet size distributions. Video streaming sends larger packets than messaging."
              },
              {
                icon: Clock,
                title: "Timing & Flow Behavior",
                description: "Timing between packets reveals application type. Real-time apps have consistent intervals, while uploads are bursty."
              },
              {
                icon: TrendingUp,
                title: "Upload/Download Ratios",
                description: "Traffic direction ratios are distinct. Streaming is asymmetric, messaging is bidirectional, uploads are one-way."
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="relative bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-8 hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,199,0,0.15)]"
              >
                <div className="mb-6 text-primary">
                  <feature.icon className="w-12 h-12" strokeWidth={1.5} />
                </div>
                <h3 className="font-mono text-xl text-white mb-4">{feature.title}</h3>
                <p className="font-mono text-sm text-foreground/70 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3 - Supported Applications */}
      <section className="relative py-24 px-4">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-sentient text-white mb-4">
              Supported <i className="font-light">Applications</i>
            </h2>
            <p className="font-mono text-foreground/70 text-sm md:text-base max-w-2xl mx-auto">
              Currently trained on three major mobile applications
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: "WhatsApp",
                category: "Messaging",
                gradient: "from-green-500/20 to-green-500/5"
              },
              {
                name: "YouTube",
                category: "Video Streaming",
                gradient: "from-red-500/20 to-red-500/5"
              },
              {
                name: "Instagram",
                category: "Social Media",
                gradient: "from-purple-500/20 to-purple-500/5"
              }
            ].map((app, index) => (
              <div 
                key={index}
                className={`relative bg-gradient-to-br ${app.gradient} backdrop-blur-sm border border-white/10 rounded-xl p-12 text-center hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,199,0,0.2)] group`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                <h3 className="relative font-sentient text-3xl md:text-4xl text-white mb-2">
                  {app.name}
                </h3>
                <p className="relative font-mono text-sm text-foreground/60 uppercase tracking-wider">
                  {app.category}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 - AI & Privacy */}
      <section className="relative py-24 px-4">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-sentient text-white mb-4">
              AI & <i className="font-light">Privacy</i>
            </h2>
            <p className="font-mono text-foreground/70 text-sm md:text-base max-w-2xl mx-auto">
              Advanced analysis without compromising security
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Column */}
            <div className="space-y-8">
              <div>
                <h3 className="font-sentient text-3xl md:text-4xl text-white mb-6">
                  Privacy-Preserving AI
                </h3>
                <div className="space-y-4">
                  {[
                    { icon: Lock, text: "No packet decryption" },
                    { icon: Database, text: "Metadata only" },
                    { icon: Shield, text: "Secure analysis" },
                    { icon: Brain, text: "Academic-grade ML" }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-4 group">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                        <item.icon className="w-5 h-5 text-primary" strokeWidth={2} />
                      </div>
                      <p className="font-mono text-foreground/80 text-base md:text-lg">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Flow Diagram */}
            <div className="relative bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-12 hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,199,0,0.15)]">
              <div className="flex flex-col items-center gap-8">
                <div className="w-full text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-primary/10 border border-primary/30 mb-2">
                    <Upload className="w-10 h-10 text-primary" strokeWidth={1.5} />
                  </div>
                  <p className="font-mono text-foreground/80 text-sm">PCAP File</p>
                </div>
                
                <div className="w-px h-12 bg-gradient-to-b from-primary/50 to-primary/10" />
                
                <div className="w-full text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-primary/10 border border-primary/30 mb-2">
                    <Zap className="w-10 h-10 text-primary" strokeWidth={1.5} />
                  </div>
                  <p className="font-mono text-foreground/80 text-sm">Feature Extraction</p>
                </div>
                
                <div className="w-px h-12 bg-gradient-to-b from-primary/50 to-primary/10" />
                
                <div className="w-full text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-primary/10 border border-primary/30 mb-2">
                    <Brain className="w-10 h-10 text-primary" strokeWidth={1.5} />
                  </div>
                  <p className="font-mono text-foreground/80 text-sm">AI Model</p>
                </div>
                
                <div className="w-px h-12 bg-gradient-to-b from-primary/50 to-primary/10" />
                
                <div className="w-full text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-primary/10 border border-primary/30 mb-2">
                    <CheckCircle2 className="w-10 h-10 text-primary" strokeWidth={1.5} />
                  </div>
                  <p className="font-mono text-foreground/80 text-sm">Prediction</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5 - Performance Metrics */}
      <section className="relative py-24 px-4">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-sentient text-white mb-4">
              Performance <i className="font-light">Metrics</i>
            </h2>
            <p className="font-mono text-foreground/70 text-sm md:text-base max-w-2xl mx-auto">
              State-of-the-art accuracy for encrypted traffic classification
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { label: "Accuracy", value: "96.8%" },
              { label: "Precision", value: "95.4%" },
              { label: "Recall", value: "94.7%" },
              { label: "F1-Score", value: "95.0%" }
            ].map((metric, index) => (
              <div 
                key={index}
                className="relative bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm border border-primary/30 rounded-xl p-8 text-center hover:border-primary/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,199,0,0.3)] group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                <p className="relative font-mono text-sm text-foreground/60 uppercase tracking-wider mb-3">
                  {metric.label}
                </p>
                <p className="relative font-sentient text-4xl md:text-5xl text-primary">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 6 - Call to Action */}
      <section className="relative py-32 px-4">
        <div className="container max-w-7xl mx-auto">
          <div className="relative bg-gradient-to-br from-primary/10 via-black/40 to-black/40 backdrop-blur-sm border border-primary/30 rounded-2xl p-12 md:p-20 text-center hover:border-primary/50 transition-all duration-500 hover:shadow-[0_0_60px_rgba(255,199,0,0.3)]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50 rounded-2xl" />
            <div className="relative">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-sentient text-white mb-6">
                Start Analyzing <br />
                <i className="font-light">Encrypted Traffic</i>
              </h2>
              <p className="font-mono text-foreground/70 text-sm md:text-base max-w-2xl mx-auto mb-12">
                Upload your PCAP file and get instant AI-powered classification results
              </p>
              <Link href="/dashboard">
                <Button 
                  size="lg" 
                  className="px-12 py-6 text-base md:text-lg font-mono hover:shadow-[0_0_30px_rgba(255,199,0,0.5)] transition-all duration-300"
                >
                  [Upload PCAP]
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer spacing */}
      <div className="h-24" />
    </>
  );
}
