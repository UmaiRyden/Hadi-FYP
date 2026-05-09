export type MatchStrength = "High" | "Medium" | "Low"

export function getStrength(confidence: number): MatchStrength {
  if (confidence >= 75) return "High"
  if (confidence >= 50) return "Medium"
  return "Low"
}

export const STRENGTH_STYLE: Record<MatchStrength, { bg: string; text: string; border: string }> = {
  High:   { bg: "rgba(34,197,94,0.15)",  text: "#4ade80",  border: "rgba(34,197,94,0.35)"  },
  Medium: { bg: "rgba(255,199,0,0.15)",  text: "#FFC700",  border: "rgba(255,199,0,0.35)"  },
  Low:    { bg: "rgba(249,115,22,0.15)", text: "#fb923c",  border: "rgba(249,115,22,0.35)" },
}
