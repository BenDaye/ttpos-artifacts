import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SignInPage } from '@/features/auth/components/sign-in-page'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/_public/signin')({
  validateSearch: searchSchema,
  component: SignInPage,
})
