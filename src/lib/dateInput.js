/**
 * Validates a `YYYY-MM-DD` admin date-input string, including calendar
 * correctness (rejects e.g. `2026-02-30`) by round-tripping through
 * `Date.UTC` and checking the parsed parts match what was entered — a plain
 * `new Date(value)` would silently roll an invalid date into the next month
 * instead of failing. Used by `AdminDateInput.jsx` and album/song release-date
 * form validation.
 */
export function isValidDateInput(value, { required = false } = {}) {
	const trimmed = String(value ?? '').trim();
	if (!trimmed) return !required;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;

	const [yearText, monthText, dayText] = trimmed.split('-');
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const date = new Date(Date.UTC(year, month - 1, day));

	return (
		Number.isInteger(year) &&
		Number.isInteger(month) &&
		Number.isInteger(day) &&
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}
