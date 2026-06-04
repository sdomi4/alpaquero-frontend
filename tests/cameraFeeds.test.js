import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildWebrtcFeedUrl,
	createConfiguredCameraFeeds,
	createCameraDeviceFeeds
} from '../src/lib/cameraFeeds.js';

test('buildWebrtcFeedUrl puts feed URLs on port 8889 of the frontend host', () => {
	assert.equal(
		buildWebrtcFeedUrl('/allsky?autoplay=1', 'https://frontend.test/control'),
		'https://frontend.test:8889/allsky?autoplay=1'
	);
	assert.equal(
		buildWebrtcFeedUrl('http://backend.test/dome', 'http://127.0.0.1:5173/control'),
		'http://127.0.0.1:8889/dome'
	);
});

test('createConfiguredCameraFeeds turns backend camera names into WebRTC paths', () => {
	assert.deepEqual(createConfiguredCameraFeeds(['sim_camera', { name: 'dome cam' }]), [
		{
			id: 'sim-camera',
			name: 'sim_camera',
			path: '/sim_camera'
		},
		{
			id: 'dome-cam',
			name: 'dome cam',
			path: '/dome%20cam'
		}
	]);
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
				path: '/main%20cam'
			}
		]
	);
});
