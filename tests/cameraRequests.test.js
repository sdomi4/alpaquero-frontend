import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCameraCommandRequest } from '../src/lib/api/cameraRequests.js';

test('buildCameraCommandRequest builds set-temperature requests', () => {
	assert.deepEqual(buildCameraCommandRequest('camera main', 'temperature', { targetTemp: -10.5 }), {
		path: '/api/observatory/camera/camera%20main/set_temperature/-10.5',
		init: {
			method: 'POST',
			headers: {}
		}
	});
});

test('buildCameraCommandRequest builds capture requests with exposure defaults', () => {
	assert.deepEqual(buildCameraCommandRequest('cam-1', 'capture', { exposure: 2.5 }), {
		path: '/api/observatory/camera/cam-1/capture',
		init: {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				exposure: 2.5,
				binX: 1,
				binY: 1,
				additional_headers: {}
			})
		}
	});
});

test('buildCameraCommandRequest preserves capture binning and additional headers', () => {
	assert.deepEqual(
		buildCameraCommandRequest('cam-1', 'capture', {
			exposure: 10,
			binX: 2,
			binY: 3,
			additional_headers: {
				filter: 'Ha'
			}
		}),
		{
			path: '/api/observatory/camera/cam-1/capture',
			init: {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					exposure: 10,
					binX: 2,
					binY: 3,
					additional_headers: {
						filter: 'Ha'
					}
				})
			}
		}
	);
});
