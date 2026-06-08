const OBSERVATORY_API_BASE = '/api/observatory';

/**
 * @typedef {'temperature' | 'capture'} CameraCommand
 */

/**
 * @typedef {{
 *   targetTemp?: number;
 *   exposure?: number;
 *   binX?: number;
 *   binY?: number;
 *   additional_headers?: Record<string, unknown>;
 * }} CameraCommandOptions
 */

/**
 * @param {string} cameraId
 * @param {CameraCommand} command
 * @param {CameraCommandOptions} options
 * @returns {{ path: string; init: RequestInit }}
 */
export function buildCameraCommandRequest(cameraId, command, options) {
	const encodedId = encodeURIComponent(cameraId);

	if (command === 'temperature') {
		const targetTemp = formatFiniteNumber(options.targetTemp, 'Camera temperature target');
		/** @type {Record<string, string>} */
		const headers = {};

		return {
			path: `${OBSERVATORY_API_BASE}/camera/${encodedId}/set_temperature/${targetTemp}`,
			init: {
				method: 'POST',
				headers
			}
		};
	}

	const payload = {
		exposure: formatFiniteNumber(options.exposure, 'Camera exposure'),
		binX: formatPositiveInteger(options.binX ?? 1, 'Camera binX'),
		binY: formatPositiveInteger(options.binY ?? 1, 'Camera binY')
	};

	return {
		path: `${OBSERVATORY_API_BASE}/camera/${encodedId}/capture`,
		init: {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		}
	};
}

/**
 * @param {number | undefined} value
 * @param {string} label
 */
function formatFiniteNumber(value, label) {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`${label} must be a finite number`);
	}

	return value;
}

/**
 * @param {number} value
 * @param {string} label
 */
function formatPositiveInteger(value, label) {
	if (!Number.isFinite(value) || value < 1) {
		throw new Error(`${label} must be at least 1`);
	}

	return Math.round(value);
}
