import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildPinpointPayload,
	runPinpointSolver,
	DEFAULT_PINPOINT_TIMEOUT_MS
} from '../src/lib/api/pinpointRequests.js';

test('buildPinpointPayload maps form values to backend field names and defaults', () => {
	assert.deepEqual(
		buildPinpointPayload({
			folderPath: 'C:\\data\\captures',
			glob: '',
			catalog: '11',
			catalogPath: '',
			ra: '12.34',
			dec: '-45.67',
			arcsecPerPixel: ''
		}),
		{
			folder_path: 'C:\\data\\captures',
			glob: '*.fits',
			catalog: 11,
			catalog_path: 'C:\\Users\\thoma\\Documents\\Phoranso\\UCAC4',
			ra: 12.34,
			dec: -45.67,
			arcsec_per_pixel: null
		}
	);
});

test('runPinpointSolver posts to the astro pinpoint endpoint with a long timeout', async () => {
	/** @type {Array<{ url: string; method: string | undefined; headers: HeadersInit | undefined; body: BodyInit | null | undefined; hasSignal: boolean }>} */
	const calls = [];

	const result = await runPinpointSolver(
		{
			folder_path: 'C:\\data',
			glob: '*.fits',
			catalog: 11,
			catalog_path: 'C:\\catalogs\\UCAC4',
			ra: 1.25,
			dec: -2.5,
			arcsec_per_pixel: 1.1
		},
		{
			fetch: async (url, init) => {
				const requestInit = init ?? {};
				calls.push({
					url: String(url),
					method: requestInit.method,
					headers: requestInit.headers,
					body: requestInit.body,
					hasSignal: Boolean(requestInit.signal)
				});

				return new Response(JSON.stringify({ solved: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}
		}
	);

	assert.deepEqual(result, { solved: true });
	assert.equal(DEFAULT_PINPOINT_TIMEOUT_MS, 6 * 60 * 60 * 1000);
	assert.deepEqual(calls, [
		{
			url: '/api/observatory/astro/pinpoint',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				folder_path: 'C:\\data',
				glob: '*.fits',
				catalog: 11,
				catalog_path: 'C:\\catalogs\\UCAC4',
				ra: 1.25,
				dec: -2.5,
				arcsec_per_pixel: 1.1
			}),
			hasSignal: true
		}
	]);
});

test('runPinpointSolver surfaces astro pinpoint endpoint errors without trying another route', async () => {
	/** @type {string[]} */
	const urls = [];

	await assert.rejects(
		runPinpointSolver(
			{
				folder_path: 'C:\\data',
				glob: '*.fits',
				catalog: 11,
				catalog_path: 'C:\\catalogs\\UCAC4',
				ra: 1.25,
				dec: -2.5,
				arcsec_per_pixel: null
			},
			{
				fetch: async (url) => {
					urls.push(String(url));

					return new Response('missing', { status: 404, statusText: 'Not Found' });
				}
			}
		),
		/Pinpoint solver failed: 404 Not Found - missing/
	);

	assert.deepEqual(urls, ['/api/observatory/astro/pinpoint']);
});
