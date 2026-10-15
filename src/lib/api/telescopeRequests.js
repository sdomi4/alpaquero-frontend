const OBSERVATORY_API_BASE = '/api/observatory';

/**
 * @typedef {'park' | 'unpark' | 'slew' | 'sun'} TelescopeCommand
 */

/**
 * @param {string} telescopeId
 * @param {TelescopeCommand} command
 * @param {boolean} [safetyOverride]
 * @param {{ ra?: string | number; dec?: string | number }} [coordinates]
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

	if (command === 'slew') headers['Content-Type'] = 'application/json';

	return {
		path: `${OBSERVATORY_API_BASE}/${buildTelescopeCommandPath(telescopeId, command)}`,
		init: {
			method: 'POST',
			headers,
			...(command === 'slew' ? { body: JSON.stringify(coordinates) } : {})
		}
	};
}

/**
 * @param {string} telescopeId
 * @param {TelescopeCommand} command
 */
function buildTelescopeCommandPath(telescopeId, command) {
	const encodedId = encodeURIComponent(telescopeId);

	if (command === 'slew') return `telescope/${encodedId}/slew`;

	if (command === 'sun') {
		return `telescope/${encodedId}/slew/sun`;
	}

	return `telescope/${encodedId}/${command}`;
}
