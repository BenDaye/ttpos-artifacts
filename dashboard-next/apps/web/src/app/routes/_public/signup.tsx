import { createFileRoute } from '@tanstack/react-router'
import { SignUpPage } from '@/features/auth/components/sign-up-page'

export const Route = createFileRoute('/_public/signup')({
  component: SignUpPage,
})
