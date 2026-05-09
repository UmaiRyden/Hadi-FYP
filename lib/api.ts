const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

// ── Types ──────────────────────────────────────────────────────────────────────

export type JobStatus =
  | "pending"
  | "parsing"
  | "extracting"
  | "classifying"
  | "completed"
  | "failed"

export interface PredictionItem {
  app: string
  confidence: number
}

export interface AnalysisResult {
  job_id: number
  status: JobStatus
  progress: number
  original_filename?: string
  predicted_app?: string
  confidence?: number
  flow_count?: number
  packet_count?: number
  processing_time?: number
  predictions?: PredictionItem[]
  error_message?: string
}

export interface FlowResult {
  flow_key: string
  predicted_app: string
  confidence: number
  vpn_detected: boolean
  features: Record<string, number>
}

export interface DeviceResult {
  source_ip: string
  flow_count: number
  predicted_app: string
  confidence: number
  predictions: PredictionItem[]
}

export interface ClassifyResponse {
  predicted_app: string
  confidence: number
  flow_count: number
  packet_count: number
  processing_time: number
  vpn_detected: boolean
  predictions: PredictionItem[]
  flows: FlowResult[]
  devices: DeviceResult[]
}

export interface PerformanceMetrics {
  accuracy: number
  precision: number
  recall: number
  f1_score: number
  confusion_matrix: {
    labels: string[]
    matrix: number[][]
  }
  training_samples: number
  test_samples: number
  feature_count: number
  feature_names: string[]
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: {
    id: number
    email: string
    full_name: string
    created_at: string
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? "Request failed")
  }
  return res.json() as Promise<T>
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const data = await handleResponse<AuthResponse>(res)
  localStorage.setItem("token", data.access_token)
  return data
}

export async function signup(
  fullName: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: fullName, email, password }),
  })
  const data = await handleResponse<AuthResponse>(res)
  localStorage.setItem("token", data.access_token)
  return data
}

export function logout() {
  localStorage.removeItem("token")
  localStorage.removeItem("job_id")
}

// ── Upload ─────────────────────────────────────────────────────────────────────

export async function uploadPcap(file: File): Promise<{ job_id: number }> {
  const form = new FormData()
  form.append("file", file)

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  })
  return handleResponse<{ job_id: number }>(res)
}

export async function classifyPcap(file: File): Promise<ClassifyResponse> {
  const form = new FormData()
  form.append("file", file)

  const res = await fetch(`${API_BASE}/api/classify`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  })
  return handleResponse<ClassifyResponse>(res)
}

// ── Analysis ───────────────────────────────────────────────────────────────────

export async function getResult(jobId: number): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/api/result/${jobId}`, {
    headers: authHeaders(),
  })
  return handleResponse<AnalysisResult>(res)
}

// ── Performance ────────────────────────────────────────────────────────────────

export async function getPerformance(): Promise<PerformanceMetrics> {
  const res = await fetch(`${API_BASE}/api/performance`)
  return handleResponse<PerformanceMetrics>(res)
}
