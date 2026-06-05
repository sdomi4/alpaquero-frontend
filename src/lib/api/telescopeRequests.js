const OBSERVATORY_API_BASE = '/api/observatory';

/**
 * @typedef {'park' | 'unpark' | 'slew' | 'sun'} TelescopeCommand
 */

/**
 * @param {string} telescopeId
 * @param {TelescopeCommand} command
 * @param {boolean} [safetyOverride]
 * @param {{ ra?: number; dec?: number }} [coordinates]
 */
export function buildTelescopeCommandRequest(
	telescopeId,
	command,
	safetyOverride = false,
	coordinates = {}
) {
	/** @type {Record<string, string>} */
	const headers = {};

	if (safetyOverride) {
		headers['x-safety-override'] = 'true';
	}

	return {
		path: `${OBSERVATORY_API_BASE}/${buildTelescopeCommandPath(telescopeId, command, coordinates)}`,
		init: {
			method: 'POST',
			headers
		}
	};
}

/**
 * @param {string} telescopeId
 * @param {TelescopeCommand} command
 * @param {{ ra?: number; dec?: number }} coordinates
 */
function buildTelescopeCommandPath(telescopeId, command, coordinates) {
	const encodedId = encodeURIComponent(telescopeId);

	if (command === 'slew') {
		return `telescope/${encodedId}/slew/${formatCoordinate(coordinates.ra)}/${formatCoordinate(
			coordinates.dec
		)}`;
	}

	if (command === 'sun') {
		return `telescope/${encodedId}/slew/sun`;
	}

	return `telescope/${encodedId}/${command}`;
}

/**
 * @param {number | undefined} value
 */
function formatCoordinate(value) {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error('Telescope slew requires finite RA and Dec coordinates');
	}

	return encodeURIComponent(String(value));
}
