import { createFileRoute, redirect } from '@tanstack/react-router'
import { isAuthenticated } from '@/features/auth/auth-store'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({
      to: isAuthenticated() ? '/applications' : '/signin',
    })
  },
})
