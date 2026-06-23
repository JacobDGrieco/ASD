let _time = null;
let _videoElement = null;

export function storePortalVideoTime(t) {
	_time = typeof t === 'number' ? t : null;
}

export function consumePortalVideoTime() {
	const t = _time;
	_time = null;
	return t;
}

export function storePortalVideoElement(el) {
	_videoElement = el || null;
}

export function consumePortalVideoElement() {
	const el = _videoElement;
	_videoElement = null;
	return el;
}
