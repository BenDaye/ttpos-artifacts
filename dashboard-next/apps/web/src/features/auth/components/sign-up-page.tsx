import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { KeyRound, Loader2, LockKeyhole, User } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useSignUpMutation } from '@/features/auth/hooks'
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
  username: z.string().min(2),
  password: z.string().min(8),
  secretKey: z.string().min(1),
})
type Values = z.infer<typeof schema>

export function SignUpPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const mutation = useSignUpMutation()
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
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                  </div>
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
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <FormControl>
                      <Input className="pl-9" {...field} />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
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
