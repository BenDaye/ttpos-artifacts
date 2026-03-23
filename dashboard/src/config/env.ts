export const env = {
  /** 空字符串时在 dev 下配合 Vite proxy，请求走同源避免跨域 */
  API_URL: import.meta.env.VITE_API_URL ?? '',
  PORT: import.meta.env.VITE_PORT,
} as const;
