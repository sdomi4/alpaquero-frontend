/**
 * @typedef {{ id: string; name: string; path: string }} CameraFeed
 */

const WEBRTC_PORT = '8889';

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
 * @param {string} path
 * @param {string} currentHref
 */
export function buildWebrtcFeedUrl(path, currentHref) {
	const currentUrl = new URL(currentHref);
	const feedUrl = new URL(path, currentUrl.origin);
	const port =
		currentUrl.protocol === 'http:' || currentUrl.protocol === 'https:' ? WEBRTC_PORT : '';

	return `${currentUrl.protocol}//${currentUrl.hostname}${port ? `:${port}` : ''}${feedUrl.pathname}${feedUrl.search}${feedUrl.hash}`;
}

/**
 * @param {unknown} camera
 */
function getCameraName(camera) {
	if (typeof camera === 'string') return camera.trim();

	if (!camera || typeof camera !== 'object') return '';

	const cameraRecord = /** @type {Record<string, unknown>} */ (camera);
	const value = cameraRecord.name ?? cameraRecord.camera_name ?? cameraRecord.id;
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {unknown[]} cameras
 * @returns {CameraFeed[]}
 */
export function createConfiguredCameraFeeds(cameras) {
	return cameras
		.map((camera) => getCameraName(camera))
		.filter((name) => name.length > 0)
		.map((name) => ({
			id: slugify(name),
			name,
			path: `/${encodeURIComponent(name)}`
		}));
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
				path: `/${encodeURIComponent(device.id)}`
			};
		});
}
