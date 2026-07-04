import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/** Wrap arbitrary JSON data as a single text content block. */
export function toTextResult(data: unknown): CallToolResult {
  const text = typeof data === 'string' ? data : JSON.stringify(data ?? null, null, 2)
  return { content: [{ type: 'text', text }] }
}

/** Wrap an error as an `isError` text result so the model can read it. */
export function toErrorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error)
  return { content: [{ type: 'text', text: message }], isError: true }
}

/** Run a producer and convert its result (or thrown error) into a tool result. */
export async function guard(produce: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return toTextResult(await produce())
  }
  catch (error) {
    return toErrorResult(error)
  }
}
