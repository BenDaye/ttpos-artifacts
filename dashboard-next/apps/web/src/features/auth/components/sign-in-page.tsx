import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, LockKeyhole, User } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useLoginMutation } from '@/features/auth/hooks'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'

const schema = z.object({
  username: z.string().min(1, 'Required'),
  password: z.string().min(1, 'Required'),
})
type Values = z.infer<typeof schema>

function getSafeRedirectTarget(): string {
  if (typeof window === 'undefined') {
    return '/applications'
  }

  const redirectParam = new URLSearchParams(window.location.search).get('redirect')
  if (!redirectParam) {
    return '/applications'
  }

  try {
    const url = new URL(redirectParam, window.location.origin)
    if (url.origin !== window.location.origin) {
      return '/applications'
    }
    return `${url.pathname}${url.search}${url.hash}`
  }
  catch {
    return '/applications'
  }
}

export function SignInPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const mutation = useLoginMutation()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values)
      toast.success(t('signin.success', { defaultValue: 'Signed in' }))
      const redirectTarget = getSafeRedirectTarget()
      if (redirectTarget === '/applications') {
        void navigate({ to: '/applications' })
      }
      else {
        window.location.assign(redirectTarget)
      }
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('signin.error', { defaultValue: 'Sign-in failed' })
      toast.error(message)
    }
  })

  return (
    <Card className="w-[min(92vw,26rem)]">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          {t('signin.title', { defaultValue: 'Welcome back' })}
        </CardTitle>
        <CardDescription>
          {t('signin.subtitle', { defaultValue: 'Sign in to continue' })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.username', { defaultValue: 'Username' })}</FormLabel>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <FormControl>
                      <Input className="pl-9" autoComplete="username" {...field} />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.password', { defaultValue: 'Password' })}</FormLabel>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <FormControl>
                      <Input
                        type="password"
                        className="pl-9"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('signin.submit', { defaultValue: 'Sign in' })}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center">
        <span className="text-sm text-muted-foreground">
          {t('signin.no_account', { defaultValue: 'No account?' })}
          {' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            {t('signup.title', { defaultValue: 'Sign up' })}
          </Link>
        </span>
      </CardFooter>
    </Card>
  )
}
