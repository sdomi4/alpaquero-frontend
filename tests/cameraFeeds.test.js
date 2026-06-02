import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildSameHostFeedUrl,
	createCameraDeviceFeeds,
	parseWebrtcFeedConfig
} from '../src/lib/cameraFeeds.js';

test('parseWebrtcFeedConfig reads named feed paths from a comma-separated config', () => {
	assert.deepEqual(parseWebrtcFeedConfig('All Sky|/webrtc/allsky, Dome|webrtc/dome'), [
		{
			id: 'all-sky',
			name: 'All Sky',
			path: '/webrtc/allsky'
		},
		{
			id: 'dome',
			name: 'Dome',
			path: 'webrtc/dome'
		}
	]);
});

test('parseWebrtcFeedConfig ignores malformed or empty feed entries', () => {
	assert.deepEqual(parseWebrtcFeedConfig(' , Missing Path| , /bare-path , Pier|/webrtc/pier'), [
		{
			id: 'pier',
			name: 'Pier',
			path: '/webrtc/pier'
		}
	]);
});

test('buildSameHostFeedUrl keeps feed URLs on the frontend host', () => {
	assert.equal(
		buildSameHostFeedUrl('/webrtc/allsky?autoplay=1', 'https://frontend.test/control'),
		'https://frontend.test/webrtc/allsky?autoplay=1'
	);
	assert.equal(
		buildSameHostFeedUrl('http://backend.test/webrtc/dome', 'https://frontend.test/control'),
		'https://frontend.test/webrtc/dome'
	);
});

test('createCameraDeviceFeeds uses configured camera devices as default feeds', () => {
	assert.deepEqual(
		createCameraDeviceFeeds([
			{ id: 'main cam', name: 'Main Camera', type: 'camera' },
			{ id: 'dome', name: 'Dome', type: 'dome' }
		]),
		[
			{
				id: 'main-cam',
				name: 'Main Camera',
				path: '/webrtc/main%20cam'
			}
		]
	);
});
