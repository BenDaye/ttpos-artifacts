import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react'
import type { ControllerProps, FieldPath, FieldValues } from 'react-hook-form'
import { Children, cloneElement, createContext, isValidElement, use, useId } from 'react'
import { Controller, FormProvider, useFormContext } from 'react-hook-form'
import { cn } from '@/shared/lib/utils'
import { Label } from './label'

export const Form = FormProvider

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null)

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext>
  )
}

interface FormItemContextValue {
  id: string
}

const FormItemContext = createContext<FormItemContextValue | null>(null)

export function useFormField() {
  const fieldCtx = use(FormFieldContext)
  const itemCtx = use(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  if (!fieldCtx) {
    throw new Error('useFormField must be used within <FormField>')
  }

  const fieldState = getFieldState(fieldCtx.name, formState)
  const id = itemCtx?.id ?? fieldCtx.name

  return {
    id,
    name: fieldCtx.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

export function FormItem({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  const id = useId()
  return (
    <FormItemContext value={{ id }}>
      <div className={cn('space-y-2', className)} {...props} />
    </FormItemContext>
  )
}

export function FormLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<'label'>) {
  const { error, formItemId } = useFormField()
  return (
    <Label
      className={cn(error && 'text-destructive', className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

export function FormDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<'p'>) {
  const { formDescriptionId } = useFormField()
  return (
    <p
      id={formDescriptionId}
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  )
}

interface FormControlProps {
  children: ReactNode
}

export function FormControl({ children }: FormControlProps) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()
  const child = Children.only(children) as ReactElement<Record<string, unknown>>
  if (!isValidElement(child)) {
    return child
  }
  return cloneElement(child, {
    'id': formItemId,
    'aria-describedby': error
      ? `${formDescriptionId} ${formMessageId}`
      : formDescriptionId,
    'aria-invalid': error ? true : undefined,
  })
}

export function FormMessage({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<'p'> & { children?: ReactNode }) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error.message) : children
  if (!body) {
    return null
  }
  return (
    <p
      id={formMessageId}
      className={cn('text-xs font-medium text-destructive', className)}
      {...props}
    >
      {body}
    </p>
  )
}
