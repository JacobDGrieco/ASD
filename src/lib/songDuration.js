const MAX_SONG_DURATION_MINUTES = 99;

function formatSongDuration(minutes, seconds) {
	const minutesText = String(minutes).padStart(2, '0');
	const secondsText = String(seconds).padStart(2, '0');
	return `${minutesText}:${secondsText}`;
}

function parseInteger(value) {
	const parsed = Number(value);
	return Number.isInteger(parsed) ? parsed : null;
}

export function normalizeSongDuration(value) {
	const text = typeof value === 'string' ? value.trim() : '';
	if (!text) return '';

	const match = text.match(/^(\d+):([0-5]?\d)$/);
	if (!match) return null;

	const minutes = parseInteger(match[1]);
	const seconds = parseInteger(match[2]);
	if (minutes === null || seconds === null || minutes > MAX_SONG_DURATION_MINUTES) return null;

	return formatSongDuration(minutes, seconds);
}

export function isValidSongDuration(value) {
	return normalizeSongDuration(value) !== null;
}

export function songDurationToParts(value) {
	const duration = normalizeSongDuration(value);
	if (!duration) return { minutes: '', seconds: '' };

	const [minutesText, secondsText] = duration.split(':');
	return { minutes: minutesText, seconds: secondsText };
}

export function songDurationFromParts(minutesValue, secondsValue) {
	const minutesText = typeof minutesValue === 'string' ? minutesValue.trim() : '';
	const secondsText = typeof secondsValue === 'string' ? secondsValue.trim() : '';
	if (!minutesText && !secondsText) return '';

	const minutes = parseInteger(minutesText || '0');
	const seconds = parseInteger(secondsText || '0');
	if (
		minutes === null ||
		seconds === null ||
		minutes < 0 ||
		seconds < 0 ||
		minutes > MAX_SONG_DURATION_MINUTES ||
		seconds > 59
	) {
		return null;
	}

	return formatSongDuration(minutes, seconds);
}
