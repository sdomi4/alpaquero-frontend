import assert from 'node:assert/strict';
import test from 'node:test';

import {
	getLivestreamCameraSettings,
	listLivestreams,
	normalizeLivestreamNames,
	startLivestream,
	stopLivestream,
	updateLivestreamCameraSettings
} from '../src/lib/api/livestreamRequests.js';

test('normalizeLivestreamNames reads configured names from the backend mapping', () => {
	assert.deepEqual(
		normalizeLivestreamNames({ allsky: 'http://stream-one', 'dome cam': 'http://stream-two' }),
		['allsky', 'dome cam']
	);
	assert.deepEqual(normalizeLivestreamNames(null), []);
	assert.deepEqual(normalizeLivestreamNames([]), []);
});

test('listLivestreams requests and normalizes the livestream catalog', async () => {
	/** @type {Array<{ url: string; init: RequestInit | undefined }>} */
	const calls = [];
	const names = await listLivestreams(async (url, init) => {
		calls.push({ url: String(url), init });
		return new Response(JSON.stringify({ preview: 'http://asi-stream:8000' }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	});

	assert.deepEqual(names, ['preview']);
	assert.deepEqual(calls, [{ url: '/api/observatory/observatory/livestreams', init: undefined }]);
});

test('listLivestreams preserves a null catalog so controls can remain hidden', async () => {
	const names = await listLivestreams(
		async () =>
			new Response('null', {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
	);

	assert.equal(names, null);
});

test('livestream actions encode names and post to start and stop routes', async () => {
	/** @type {Array<{ url: string; init: RequestInit | undefined }>} */
	const calls = [];
	/** @type {typeof globalThis.fetch} */
	const fetcher = async (url, init) => {
		calls.push({ url: String(url), init });
		return new Response(JSON.stringify({ running: String(url).endsWith('/start') }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	};

	assert.deepEqual(await startLivestream('dome preview', fetcher), { running: true });
	assert.deepEqual(await stopLivestream('dome preview', fetcher), { running: false });
	assert.deepEqual(calls, [
		{
			url: '/api/observatory/observatory/livestreams/dome%20preview/start',
			init: { method: 'POST' }
		},
		{
			url: '/api/observatory/observatory/livestreams/dome%20preview/stop',
			init: { method: 'POST' }
		}
	]);
});

test('livestream camera settings use the prefixed GET and PATCH routes', async () => {
	/** @type {Array<{ url: string; init: RequestInit | undefined }>} */
	const calls = [];
	/** @type {typeof globalThis.fetch} */
	const fetcher = async (url, init) => {
		calls.push({ url: String(url), init });
		return new Response(JSON.stringify({ controls: { exposure: 1000, gain: 120 } }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	};

	assert.deepEqual(await getLivestreamCameraSettings('dome preview', fetcher), {
		controls: { exposure: 1000, gain: 120 }
	});
	assert.deepEqual(
		await updateLivestreamCameraSettings('dome preview', { controls: { exposure: 2500 } }, fetcher),
		{ controls: { exposure: 1000, gain: 120 } }
	);
	assert.deepEqual(calls, [
		{
			url: '/api/observatory/observatory/livestreams/dome%20preview/camera',
			init: undefined
		},
		{
			url: '/api/observatory/observatory/livestreams/dome%20preview/camera',
			init: {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ controls: { exposure: 2500 } })
			}
		}
	]);
});

test('livestream errors include backend detail', async () => {
	await assert.rejects(
		() =>
			startLivestream(
				'missing',
				async () =>
					new Response(JSON.stringify({ detail: "Livestream 'missing' not found" }), {
						status: 404,
						headers: { 'content-type': 'application/json' }
					})
			),
		/Livestream start failed: Livestream 'missing' not found/
	);
});
