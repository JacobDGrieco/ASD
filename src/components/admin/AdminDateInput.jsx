import { useRef } from 'react';

export default function AdminDateInput({
	id,
	value,
	onChange,
	className,
	ariaLabel = 'Date',
	ariaInvalid,
	disabled,
	required,
}) {
	const replaceOnNextDigitRef = useRef(false);

	return (
		<input
			id={id}
			type="date"
			value={value ?? ''}
			onFocus={() => {
				replaceOnNextDigitRef.current = Boolean(value);
			}}
			onBlur={() => {
				replaceOnNextDigitRef.current = false;
			}}
			onKeyDown={(event) => {
				if (!replaceOnNextDigitRef.current) return;
				if (!/^\d$/.test(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;

				replaceOnNextDigitRef.current = false;
				onChange('');
			}}
			onChange={(event) => {
				replaceOnNextDigitRef.current = false;
				onChange(event.target.value);
			}}
			className={className}
			aria-label={ariaLabel}
			aria-invalid={ariaInvalid}
			aria-required={required}
			disabled={disabled}
			min="0001-01-01"
			max="9999-12-31"
		/>
	);
}
