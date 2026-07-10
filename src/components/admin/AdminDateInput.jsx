import { useRef } from 'react'

function digitsOnly(value) {
  return String(value ?? '').replace(/\D+/g, '').slice(0, 8)
}

export function normalizeDateInput(value) {
  const digits = digitsOnly(value)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

export function isValidDateInput(value, { required = false } = {}) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return !required
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false

  const [yearText, monthText, dayText] = trimmed.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export default function AdminDateInput({
  id,
  value,
  onChange,
  className,
  ariaInvalid,
  disabled,
  required,
}) {
  const replaceOnNextDigitRef = useRef(false)

  return (
    <input
      id={id}
      type="date"
      value={value ?? ''}
      onFocus={() => {
        replaceOnNextDigitRef.current = Boolean(value)
      }}
      onBlur={() => {
        replaceOnNextDigitRef.current = false
      }}
      onKeyDown={(event) => {
        if (!replaceOnNextDigitRef.current) return
        if (!/^\d$/.test(event.key) || event.ctrlKey || event.metaKey || event.altKey) return

        replaceOnNextDigitRef.current = false
        onChange('')
      }}
      onChange={(event) => {
        replaceOnNextDigitRef.current = false
        onChange(event.target.value)
      }}
      className={className}
      aria-invalid={ariaInvalid}
      aria-required={required}
      disabled={disabled}
      min="0001-01-01"
      max="9999-12-31"
    />
  )
}
