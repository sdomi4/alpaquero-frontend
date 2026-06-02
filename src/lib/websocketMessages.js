/**
 * @typedef {object} ObservatoryLogMessage
 * @property {string} level
 * @property {string} message
 * @property {string} timestamp
 * @property {string} receivedAt
 * @property {string} raw
 */

/**
 * @param {string} raw
 * @param {string} [receivedAt]
 * @returns {ObservatoryLogMessage}
 */
export function parseObservatoryLogMessage(raw, receivedAt = new Date().toISOString()) {
	try {
		const payload = JSON.parse(raw);

		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			throw new Error('Expected an object payload');
		}

		return {
			level: typeof payload.level === 'string' && payload.level ? payload.level : 'info',
			message:
				typeof payload.message === 'string' && payload.message
					? payload.message
					: 'Websocket update received',
			timestamp:
				typeof payload.timestamp === 'string' && payload.timestamp ? payload.timestamp : receivedAt,
			receivedAt,
			raw
		};
	} catch {
		return {
			level: 'error',
			message: 'Invalid websocket message',
			timestamp: receivedAt,
			receivedAt,
			raw
		};
	}
}
