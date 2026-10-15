/**
 * @typedef {{
 *   positionRa: string | null;
 *   positionDec: string | null;
 *   targetRa: string | null;
 *   targetDec: string | null;
 *   parked: boolean | null;
 *   slewing: boolean | null;
 *   tracking: boolean | null;
 * }} TelescopeDisplayState
 */

/**
 * @param {Record<string, unknown> | null | undefined} state
 * @returns {TelescopeDisplayState}
 */
export function getTelescopeDisplayState(state) {
	const source = state ?? {};

	return {
		positionRa: firstString(source, ['position.ra', 'right_ascension', 'ra', 'RA']),
		positionDec: firstString(source, ['position.dec', 'declination', 'dec', 'DEC']),
		targetRa: firstString(source, ['target.ra', 'target_ra', 'targetRa']),
		targetDec: firstString(source, ['target.dec', 'target_dec', 'targetDec']),
		parked: firstBoolean(source, ['is_parked', 'at_park', 'parked']),
		slewing: firstBoolean(source, ['slewing', 'is_slewing']),
		tracking: firstBoolean(source, ['tracking', 'is_tracking'])
	};
}

/**
 * @param {Record<string, unknown>} source
 * @param {string[]} paths
 */
function firstString(source, paths) {
	for (const path of paths) {
		const value = readPath(source, path);
		if (typeof value === 'string' && value.length > 0) return value;
	}

	return null;
}

/**
 * @param {Record<string, unknown>} source
 * @param {string[]} paths
 */
function firstBoolean(source, paths) {
	for (const path of paths) {
		const value = readPath(source, path);

		if (typeof value === 'boolean') return value;
		if (typeof value === 'string') {
			const normalized = value.trim().toLowerCase();
			if (normalized === 'true') return true;
			if (normalized === 'false') return false;
		}
	}

	return null;
}

/**
 * @param {Record<string, unknown>} source
 * @param {string} path
 */
function readPath(source, path) {
	return path.split('.').reduce((current, key) => {
		if (!current || typeof current !== 'object') return undefined;
		return /** @type {Record<string, unknown>} */ (current)[key];
	}, /** @type {unknown} */ (source));
}
