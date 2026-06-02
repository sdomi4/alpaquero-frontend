/**
 * @typedef {{ id: string; name: string; path: string }} CameraFeed
 */

/**
 * @param {string} value
 */
function slugify(value) {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return slug || 'feed';
}

/**
 * Parse PUBLIC_WEBRTC_FEEDS-style values:
 * "All Sky|/webrtc/allsky,Dome|/webrtc/dome".
 *
 * @param {string | undefined | null} config
 * @returns {CameraFeed[]}
 */
export function parseWebrtcFeedConfig(config) {
	if (!config) return [];

	return config
		.split(',')
		.map((entry) => {
			const [rawName, ...pathParts] = entry.split('|');
			const name = rawName?.trim();
			const path = pathParts.join('|').trim();

			if (!name || !path) return null;

			return {
				id: slugify(name),
				name,
				path
			};
		})
		.filter((feed) => feed !== null);
}

/**
 * @param {string} path
 * @param {string} currentHref
 */
export function buildSameHostFeedUrl(path, currentHref) {
	const currentUrl = new URL(currentHref);
	const feedUrl = new URL(path, currentUrl.origin);

	return `${currentUrl.origin}${feedUrl.pathname}${feedUrl.search}${feedUrl.hash}`;
}

/**
 * @param {Array<{ id: string; name?: string | null; type?: string | null }>} devices
 * @returns {CameraFeed[]}
 */
export function createCameraDeviceFeeds(devices) {
	return devices
		.filter((device) => device.type === 'camera')
		.map((device) => {
			const name = device.name || device.id;

			return {
				id: slugify(device.id),
				name,
				path: `/webrtc/${encodeURIComponent(device.id)}`
			};
		});
}
