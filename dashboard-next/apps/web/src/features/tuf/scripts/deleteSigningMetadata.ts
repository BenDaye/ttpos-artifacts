import { http, HttpError } from '@/shared/lib/http'

export interface DeleteSigningMetadataParams {
  appName: string
  role: string
}

interface DeleteSigningMetadataResponse {
  message?: string
  data?: {
    task_id?: string
    last_update?: string
  }
  error?: string
}

export interface DeleteSigningMetadataResult {
  success: boolean
  hasTask: boolean
  message: string
  taskId?: string
  lastUpdate?: string
  error?: string
}

/**
 * Delete signing metadata for a specific role.
 */
export async function deleteSigningMetadata(
  params: DeleteSigningMetadataParams,
): Promise<DeleteSigningMetadataResult> {
  const { appName, role } = params

  if (!appName) {
    throw new Error('App name is required')
  }
  if (!role) {
    throw new Error('Role is required')
  }

  try {
    const response = await http.post<DeleteSigningMetadataResponse>(
      `/tuf/v1/metadata/sign/delete?appName=${encodeURIComponent(appName)}`,
      { role },
    )

    if (response.data?.task_id) {
      return {
        success: true,
        hasTask: true,
        message: response.message || 'Metadata sign delete accepted.',
        taskId: response.data.task_id,
        lastUpdate: response.data.last_update,
      }
    }

    return {
      success: true,
      hasTask: false,
      message: response.message || 'Signing metadata deleted successfully.',
    }
  }
  catch (error) {
    if (error instanceof HttpError) {
      const payload = error.payload as DeleteSigningMetadataResponse | undefined
      const message = payload?.message ?? payload?.error ?? error.message
      if (
        error.status === 404
        || message.includes('not in a signing process')
        || message.includes('No signing process')
      ) {
        return {
          success: true,
          hasTask: false,
          message: payload?.message ?? 'No signing process for root.',
        }
      }
      throw new Error(message)
    }
    throw error
  }
}
