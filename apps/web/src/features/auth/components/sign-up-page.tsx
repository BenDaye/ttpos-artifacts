import { zodResolver } from '@hookform/resolvers/zod'
import { CircleNotchIcon, KeyIcon, UserIcon } from '@phosphor-icons/react'
import { Link, useNavigate } from '@tanstack/react-router'
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
import { useSignUpMutation } from '@/features/auth/hooks'

interface Values { username: string, password: string, secretKey: string }

export function SignUpPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const mutation = useSignUpMutation()

  const schema = useMemo(() => z.object({
    username: z.string().min(2, t('validation.username_min', { count: 2, defaultValue: 'At least {{count}} characters' })),
    password: z.string().min(8, t('validation.password_min', { count: 8, defaultValue: 'At least {{count}} characters' })),
    secretKey: z.string().min(1, t('validation.secret_key_required', { defaultValue: 'Secret key is required' })),
  }), [t])

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '', secretKey: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        username: values.username,
        password: values.password,
        api_key: values.secretKey,
      })
      toast.success(t('signup.success', { defaultValue: 'Account created' }))
      void navigate({ to: '/applications' })
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('signup.error', { defaultValue: 'Sign-up failed' })
      toast.error(message)
    }
  })

  return (
    <Card className="dialog-size-auth">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          {t('signup.title', { defaultValue: 'Create account' })}
        </CardTitle>
        <CardDescription>
          {t('signup.subtitle', { defaultValue: 'You will need an admin secret key' })}
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
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="secretKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.secret_key', { defaultValue: 'Secret key' })}</FormLabel>
                  <div className="relative">
                    <KeyIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <FormControl>
                      <Input className="pl-9" {...field} />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <CircleNotchIcon className="size-4 animate-spin" />}
              {t('signup.submit', { defaultValue: 'Create account' })}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center">
        <span className="text-sm text-muted-foreground">
          {t('signup.has_account', { defaultValue: 'Already have an account?' })}
          {' '}
          <Link to="/signin" className="font-medium text-primary hover:underline">
            {t('signin.title', { defaultValue: 'Sign in' })}
          </Link>
        </span>
      </CardFooter>
    </Card>
  )
}
