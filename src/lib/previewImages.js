const OBSERVATORY_API_BASE = '/api/observatory';

/**
 * @typedef {{
 *   name: string;
 *   timestamp: string;
 *   src: string;
 * }} CapturePreview
 */

/**
 * @param {unknown} value
 */
function stringifyTimestamp(value) {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return '';
}

/**
 * @param {unknown} value
 * @param {unknown} mimeType
 */
function buildPreviewSrc(value, mimeType) {
	if (typeof value !== 'string') return '';

	const trimmed = value.trim();
	if (!trimmed) return '';
	if (trimmed.startsWith('data:')) return trimmed;

	const cleanMimeType =
		typeof mimeType === 'string' && mimeType.trim() ? mimeType.trim() : 'image/jpeg';

	return `data:${cleanMimeType};base64,${trimmed}`;
}

/**
 * @param {unknown} payload
 * @param {number} [limit]
 * @returns {CapturePreview[]}
 */
export function normalizeCapturePreviews(payload, limit = 3) {
	if (!Array.isArray(payload)) return [];

	const previews = [];

	for (const item of payload) {
		if (!item || typeof item !== 'object') continue;

		const record = /** @type {Record<string, unknown>} */ (item);
		const name = typeof record.name === 'string' ? record.name.trim() : '';
		const src = buildPreviewSrc(record.preview_jpg, record.mime_type);

		if (!name || !src) continue;

		previews.push({
			name,
			timestamp: stringifyTimestamp(record.timestamp),
			src
		});

		if (previews.length >= limit) break;
	}

	return previews;
}

/**
 * @param {string} name
 */
export function buildFullPreviewImagePath(name) {
	return `${OBSERVATORY_API_BASE}/previews/full/${encodeURIComponent(name)}`;
}
