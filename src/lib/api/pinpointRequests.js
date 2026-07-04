const OBSERVATORY_API_BASE = '/api/observatory';
const PINPOINT_PATH = 'astro/pinpoint';

export const DEFAULT_PINPOINT_TIMEOUT_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_PINPOINT_GLOB = '*.fits';
export const DEFAULT_PINPOINT_CATALOG = 11;
export const DEFAULT_PINPOINT_CATALOG_PATH = 'C:\\Users\\thoma\\Documents\\Phoranso\\UCAC4';

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
 * @param {unknown} payload
 * @param {{
 *   fetch?: typeof globalThis.fetch;
 *   timeoutMs?: number;
 * }} [options]
 */
export async function runPinpointSolver(
	payload,
	{ fetch = globalThis.fetch, timeoutMs = DEFAULT_PINPOINT_TIMEOUT_MS } = {}
) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	let lastResponse = null;
	let lastBody = null;

	try {
		const response = await fetch(`${OBSERVATORY_API_BASE}/${PINPOINT_PATH}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload),
			signal: controller.signal
		});

		const body = await readResponse(response);

		if (response.ok) {
			return body;
		}

		lastResponse = response;
		lastBody = body;
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new Error('Pinpoint solver timed out');
		}

		throw error;
	} finally {
		clearTimeout(timeoutId);
	}

	throw new Error(
		`Pinpoint solver failed: ${lastResponse?.status ?? 'unknown'} ${
			lastResponse?.statusText ?? ''
		} - ${detailMessage(lastBody)}`.trim()
	);
}
