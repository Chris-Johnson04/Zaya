import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

/* ---------- Bouton ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-river text-white hover:bg-river-dark',
  secondary: 'border border-line bg-white text-ink hover:bg-river-soft',
  ghost: 'text-river hover:bg-river-soft',
  danger: 'bg-clay text-white hover:opacity-90',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  type = 'button',
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
    >
      {loading ? 'Veuillez patienter…' : children}
    </button>
  )
}

/* ---------- Champs de formulaire ---------- */

const inputClasses =
  'mt-1 block min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-base text-ink placeholder:text-muted/70 focus:border-river'

function FieldMessage({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error) {
    return (
      <p id={id} className="mt-1 text-sm text-clay">
        {error}
      </p>
    )
  }
  if (hint) {
    return (
      <p id={id} className="mt-1 text-sm text-muted">
        {hint}
      </p>
    )
  }
  return null
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, id, className = '', ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-msg`
  return (
    <div className={className}>
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <input
        {...rest}
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={`${inputClasses} ${error ? 'border-clay' : 'border-line'}`}
      />
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  )
})

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: { value: string; label: string }[]
  hint?: string
  error?: string
}

export function SelectField({
  label,
  options,
  hint,
  error,
  id,
  className = '',
  ...rest
}: SelectFieldProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const messageId = `${selectId}-msg`
  return (
    <div className={className}>
      <label htmlFor={selectId} className="text-sm font-semibold">
        {label}
      </label>
      <select
        {...rest}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={`${inputClasses} ${error ? 'border-clay' : 'border-line'}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  )
}

/* ---------- Message d'information ---------- */

type AlertTone = 'error' | 'success' | 'info'

const alertTones: Record<AlertTone, string> = {
  error: 'border-clay/40 bg-clay/10 text-clay',
  success: 'border-river/30 bg-river-soft text-river-dark',
  info: 'border-line bg-white text-ink',
}

export function Alert({ tone = 'info', children }: { tone?: AlertTone; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm ${alertTones[tone]}`}
    >
      {children}
    </div>
  )
}