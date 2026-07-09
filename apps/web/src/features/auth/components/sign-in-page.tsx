import { zodResolver } from '@hookform/resolvers/zod'
import { CircleNotchIcon, UserIcon } from '@phosphor-icons/react'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@ttpos/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@ttpos/ui/components/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@ttpos/ui/components/form'
import { Input } from '@ttpos/ui/components/input'
import { PasswordInput } from '@ttpos/ui/components/password-input'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useLoginMutation } from '@/features/auth/hooks'

const routeApi = getRouteApi('/_public/signin')

interface Values { username: string, password: string }

function getSafeRedirectTarget(redirectParam: string | undefined): string {
  if (typeof window === 'undefined' || !redirectParam) {
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
  const { redirect } = routeApi.useSearch()
  const mutation = useLoginMutation()

  const schema = useMemo(() => z.object({
    username: z.string().min(1, t('validation.username_required', { defaultValue: 'Username is required' })),
    password: z.string().min(1, t('validation.password_required', { defaultValue: 'Password is required' })),
  }), [t])

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values)
      toast.success(t('signin.success', { defaultValue: 'Signed in' }))
      const redirectTarget = getSafeRedirectTarget(redirect)
      if (redirectTarget === '/applications') {
        void navigate({ to: '/applications' })
      }
      else {
        void navigate({ href: redirectTarget })
      }
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('signin.error', { defaultValue: 'Sign-in failed' })
      toast.error(message)
    }
  })

  return (
    <Card className="dialog-size-auth">
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
                    <UserIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
                  <FormControl>
                    <PasswordInput
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <CircleNotchIcon className="size-4 animate-spin" />}
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
