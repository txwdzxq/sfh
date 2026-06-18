/// <reference types="vite/client" />

interface Debug {
  log: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

interface Window {
  debug: Debug
}
