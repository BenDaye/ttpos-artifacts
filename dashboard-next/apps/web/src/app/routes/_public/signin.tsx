import { createFileRoute } from '@tanstack/react-router'
import { SignInPage } from '@/features/auth/components/sign-in-page'

export const Route = createFileRoute('/_public/signin')({
  component: SignInPage,
})
