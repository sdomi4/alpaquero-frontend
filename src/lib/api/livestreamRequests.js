const LIVESTREAM_API_BASE = '/api/observatory/observatory/livestreams';

/**
 * @param {unknown} payload
 * @returns {string[]}
 */
export function normalizeLivestreamNames(payload) {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];

	return Object.keys(payload).filter((name) => name.length > 0);
}

/**
 * @param {Response} response
 * @param {string} operation
 */
async function livestreamResponseError(response, operation) {
	const payload = await response
		.clone()
		.json()
		.catch(() => null);
	const detail =
		payload && typeof payload === 'object' && 'detail' in payload
			? String(payload.detail)
			: `${response.status} ${response.statusText}`.trim();

	return new Error(`${operation} failed: ${detail}`);
}

/**
 * @param {typeof globalThis.fetch} [fetcher]
 */
export async function listLivestreams(fetcher = fetch) {
	const response = await fetcher(LIVESTREAM_API_BASE);

	if (!response.ok) {
		throw await livestreamResponseError(response, 'Livestream list');
	}

	const payload = await response.json();
	return payload === null ? null : normalizeLivestreamNames(payload);
}

/**
 * @param {string} name
 * @param {'start' | 'stop'} action
 * @param {typeof globalThis.fetch} [fetcher]
 */
async function runLivestreamAction(name, action, fetcher = fetch) {
	const response = await fetcher(`${LIVESTREAM_API_BASE}/${encodeURIComponent(name)}/${action}`, {
		method: 'POST'
	});

	if (!response.ok) {
		throw await livestreamResponseError(response, `Livestream ${action}`);
	}

	return response.json().catch(() => null);
}

/**
 * @param {string} name
 * @param {typeof globalThis.fetch} [fetcher]
 */
export function startLivestream(name, fetcher = fetch) {
	return runLivestreamAction(name, 'start', fetcher);
}

/**
 * @param {string} name
 * @param {typeof globalThis.fetch} [fetcher]
 */
export function stopLivestream(name, fetcher = fetch) {
	return runLivestreamAction(name, 'stop', fetcher);
}
