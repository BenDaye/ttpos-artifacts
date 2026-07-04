import type { StepStatus, TaskState } from './types'

export function getStatusColor(status: StepStatus) {
  switch (status) {
    case 'ready':
      return 'text-primary'
    case 'in-progress':
      return 'text-muted-foreground'
    case 'success':
      return 'text-primary'
    case 'error':
      return 'text-primary'
    case 'waiting':
    case 'disabled':
    default:
      return 'text-muted-foreground'
  }
}

export function getStatusIcon(status: StepStatus) {
  switch (status) {
    case 'ready':
      return 'fa-circle'
    case 'in-progress':
      return 'fa-spinner fa-spin'
    case 'success':
      return 'fa-check-circle'
    case 'error':
      return 'fa-times-circle'
    case 'waiting':
      return 'fa-clock'
    case 'disabled':
    default:
      return 'fa-circle'
  }
}

export function getTaskStateColor(state: TaskState) {
  switch (state) {
    case 'SUCCESS':
      return 'text-primary'
    case 'FAILURE':
      return 'text-primary'
    case 'PENDING':
      return 'text-muted-foreground'
    default:
      return 'text-muted-foreground'
  }
}
