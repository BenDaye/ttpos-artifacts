export const env = {
  API_URL: (import.meta.env.VITE_API_URL ?? '').toString(),
  PORT: import.meta.env.VITE_PORT,
  DEV: import.meta.env.DEV,
} as const
