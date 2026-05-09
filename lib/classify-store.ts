/**
 * Module-level store that holds the in-flight POST /api/classify promise
 * so it can survive a Next.js client-side navigation from dashboard → processing.
 *
 * This avoids needing a global state library — the promise is started on the
 * dashboard, navigation happens immediately, and the processing page awaits it.
 */
import { classifyPcap, type ClassifyResponse } from "./api"

let _promise: Promise<ClassifyResponse> | null = null
let _filename = ""

export function startClassify(file: File): void {
  _filename = file.name
  _promise  = classifyPcap(file)
}

export function getClassifyPromise(): Promise<ClassifyResponse> | null {
  return _promise
}

export function getClassifyFilename(): string {
  return _filename
}

export function clearClassify(): void {
  _promise  = null
  _filename = ""
}
