const OBSERVATORY_API_BASE = '/api/observatory';
const PINPOINT_PATH = 'astro/pinpoint';

export const DEFAULT_PINPOINT_TIMEOUT_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_PINPOINT_POLL_INTERVAL_MS = 1000;
export const DEFAULT_PINPOINT_GLOB = '*.fits';
export const DEFAULT_PINPOINT_CATALOG = 11;
export const DEFAULT_PINPOINT_CATALOG_PATH = 'C:\\Users\\thoma\\Documents\\Phoranso\\UCAC4';

const ACTIVE_JOB_STATUSES = new Set(['queued', 'running']);

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function requiredNumber(value, fieldName) {
	const number = Number(value);

	if (!Number.isFinite(number)) {
		throw new Error(`${fieldName} must be a number`);
	}

	return number;
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function stringOrDefault(value, fallback) {
	const trimmed = typeof value === 'string' ? value.trim() : '';
	return trimmed || fallback;
}

/**
 * @param {{
 *   folderPath: string;
 *   glob: string;
 *   catalog: string | number;
 *   catalogPath: string;
 *   ra: string | number;
 *   dec: string | number;
 *   arcsecPerPixel: string | number | null;
 * }} form
 */
export function buildPinpointPayload(form) {
	const folderPath = stringOrDefault(form.folderPath, '');

	if (!folderPath) {
		throw new Error('Folder path is required');
	}

	const arcsecPerPixel =
		form.arcsecPerPixel === null || String(form.arcsecPerPixel).trim() === ''
			? null
			: requiredNumber(form.arcsecPerPixel, 'Arcsec per pixel');

	return {
		folder_path: folderPath,
		glob: stringOrDefault(form.glob, DEFAULT_PINPOINT_GLOB),
		catalog: requiredNumber(form.catalog || DEFAULT_PINPOINT_CATALOG, 'Catalog'),
		catalog_path: stringOrDefault(form.catalogPath, DEFAULT_PINPOINT_CATALOG_PATH),
		ra: requiredNumber(form.ra, 'RA'),
		dec: requiredNumber(form.dec, 'Dec'),
		arcsec_per_pixel: arcsecPerPixel
	};
}

/**
 * @param {unknown} value
 */
function detailMessage(value) {
	if (value && typeof value === 'object' && 'detail' in value) {
		const detail = value.detail;
		if (typeof detail === 'string') return detail;
	}

	if (typeof value === 'string') return value;

	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

/**
 * @param {Response} response
 */
async function readResponse(response) {
	const contentType = response.headers.get('content-type') ?? '';

	if (contentType.includes('application/json')) {
		return response.json();
	}

	const text = await response.text();
	return text ? text : null;
}

/**
 * Routes a backend-provided status path back through the frontend observatory proxy.
 *
 * @param {string} statusUrl
 */
export function buildPinpointStatusUrl(statusUrl) {
	if (typeof statusUrl !== 'string' || !statusUrl.trim()) {
		throw new Error('Pinpoint job response did not include a status URL');
	}

	let path = statusUrl.trim();
	if (/^https?:\/\//i.test(path)) {
		const parsed = new URL(path);
		path = `${parsed.pathname}${parsed.search}`;
	}

	if (path.startsWith(`${OBSERVATORY_API_BASE}/`)) return path;

	return `${OBSERVATORY_API_BASE}/${path.replace(/^\/+/, '')}`;
}

/** @param {unknown} status */
export function isPinpointJobActive(status) {
	return typeof status === 'string' && ACTIVE_JOB_STATUSES.has(status);
}

/**
 * @param {string} url
 * @param {RequestInit} init
 * @param {typeof globalThis.fetch} fetch
 * @param {string} failureLabel
 */
async function requestJson(url, init, fetch, failureLabel) {
	const response = await fetch(url, init);
	const body = await readResponse(response);

	if (response.ok) return body;

	throw new Error(
		`${failureLabel}: ${response.status} ${response.statusText} - ${detailMessage(body)}`.trim()
	);
}

/**
 * @param {unknown} payload
 * @param {{ fetch?: typeof globalThis.fetch; signal?: AbortSignal }} [options]
 */
export async function startPinpointJob(payload, { fetch = globalThis.fetch, signal } = {}) {
	return requestJson(
		`${OBSERVATORY_API_BASE}/${PINPOINT_PATH}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			signal
		},
		fetch,
		'Pinpoint job creation failed'
	);
}

/**
 * @param {string} statusUrl
 * @param {{ fetch?: typeof globalThis.fetch; signal?: AbortSignal }} [options]
 */
export async function getPinpointJobStatus(statusUrl, { fetch = globalThis.fetch, signal } = {}) {
	return requestJson(
		buildPinpointStatusUrl(statusUrl),
		{ method: 'GET', signal },
		fetch,
		'Pinpoint job status failed'
	);
}

/**
 * @param {number} milliseconds
 * @param {AbortSignal} signal
 */
function wait(milliseconds, signal) {
	if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));

	return new Promise((resolve, reject) => {
		const onAbort = () => {
			clearTimeout(timeoutId);
			reject(new DOMException('Aborted', 'AbortError'));
		};
		const timeoutId = setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve(undefined);
		}, milliseconds);
		signal.addEventListener('abort', onAbort, { once: true });
	});
}

/**
 * @param {unknown} payload
 * @param {{
 *   fetch?: typeof globalThis.fetch;
 *   timeoutMs?: number;
 *   pollIntervalMs?: number;
 *   signal?: AbortSignal;
 *   onUpdate?: (job: any) => void;
 * }} [options]
 */
export async function runPinpointSolver(
	payload,
	{
		fetch = globalThis.fetch,
		timeoutMs = DEFAULT_PINPOINT_TIMEOUT_MS,
		pollIntervalMs = DEFAULT_PINPOINT_POLL_INTERVAL_MS,
		signal,
		onUpdate
	} = {}
) {
	const controller = new AbortController();
	let timedOut = false;
	const abortFromCaller = () => controller.abort();
	const timeoutId = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeoutMs);
	signal?.addEventListener('abort', abortFromCaller, { once: true });

	try {
		const created = await startPinpointJob(payload, { fetch, signal: controller.signal });
		onUpdate?.(created);

		if (!created || typeof created !== 'object' || !('status_url' in created)) {
			throw new Error('Pinpoint job response did not include a status URL');
		}

		let latest = created;
		do {
			if (isPinpointJobActive(latest.status)) {
				await wait(pollIntervalMs, controller.signal);
			}

			latest = await getPinpointJobStatus(String(created.status_url), {
				fetch,
				signal: controller.signal
			});
			onUpdate?.(latest);
		} while (isPinpointJobActive(latest?.status));

		return latest;
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError' && timedOut) {
			throw new Error('Pinpoint solver timed out', { cause: error });
		}

		throw error;
	} finally {
		clearTimeout(timeoutId);
		signal?.removeEventListener('abort', abortFromCaller);
	}
}
