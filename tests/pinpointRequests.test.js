import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildPinpointStatusUrl,
	buildPinpointPayload,
	getPinpointJobStatus,
	runPinpointSolver,
	startPinpointJob,
	DEFAULT_PINPOINT_POLL_INTERVAL_MS,
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

test('runPinpointSolver creates a job, reports updates, and polls to completion', async () => {
	/** @type {Array<{ url: string; method: string | undefined; headers: HeadersInit | undefined; body: BodyInit | null | undefined; hasSignal: boolean }>} */
	const calls = [];
	const responses = [
		{
			job_id: 'job-1',
			status: 'queued',
			status_url: '/astro/pinpoint/job-1',
			total_files: 2
		},
		{
			job_id: 'job-1',
			status: 'running',
			total_files: 2,
			processed_files: 1
		},
		{
			job_id: 'job-1',
			status: 'completed',
			total_files: 2,
			processed_files: 2,
			results: []
		}
	];
	/** @type {string[]} */
	const updates = [];

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

				return new Response(JSON.stringify(responses.shift()), {
					status: requestInit.method === 'POST' ? 202 : 200,
					headers: { 'content-type': 'application/json' }
				});
			},
			pollIntervalMs: 0,
			onUpdate: (update) => updates.push(update.status)
		}
	);

	assert.equal(result.status, 'completed');
	assert.deepEqual(updates, ['queued', 'running', 'completed']);
	assert.equal(DEFAULT_PINPOINT_TIMEOUT_MS, 6 * 60 * 60 * 1000);
	assert.equal(DEFAULT_PINPOINT_POLL_INTERVAL_MS, 1000);
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
		},
		{
			url: '/api/observatory/astro/pinpoint/job-1',
			method: 'GET',
			headers: undefined,
			body: undefined,
			hasSignal: true
		},
		{
			url: '/api/observatory/astro/pinpoint/job-1',
			method: 'GET',
			headers: undefined,
			body: undefined,
			hasSignal: true
		}
	]);
});

test('runPinpointSolver fetches final details when creation already reports a terminal status', async () => {
	/** @type {string[]} */
	const urls = [];

	const result = await runPinpointSolver(
		{ folder_path: 'C:\\empty', ra: 1, dec: 2 },
		{
			pollIntervalMs: 0,
			fetch: async (url, init) => {
				urls.push(String(url));
				const body =
					init?.method === 'POST'
						? {
								job_id: 'empty-job',
								status: 'completed',
								status_url: '/astro/pinpoint/empty-job',
								total_files: 0
							}
						: {
								job_id: 'empty-job',
								status: 'completed',
								total_files: 0,
								processed_files: 0,
								results: [],
								errors: []
							};
				return Response.json(body, { status: init?.method === 'POST' ? 202 : 200 });
			}
		}
	);

	assert.equal(result.processed_files, 0);
	assert.deepEqual(urls, [
		'/api/observatory/astro/pinpoint',
		'/api/observatory/astro/pinpoint/empty-job'
	]);
});

test('pinpoint status URLs are always routed through the observatory proxy', () => {
	assert.equal(
		buildPinpointStatusUrl('https://backend.local/astro/pinpoint/job-1?view=full'),
		'/api/observatory/astro/pinpoint/job-1?view=full'
	);
	assert.equal(
		buildPinpointStatusUrl('/api/observatory/astro/pinpoint/job-1'),
		'/api/observatory/astro/pinpoint/job-1'
	);
});

test('pinpoint requests surface FastAPI detail errors', async () => {
	/** @type {string[]} */
	const urls = [];

	await assert.rejects(
		startPinpointJob(
			{ folder_path: 'C:\\missing', ra: 1.25, dec: -2.5 },
			{
				fetch: async (url) => {
					urls.push(String(url));

					return Response.json(
						{ detail: 'Folder does not exist' },
						{ status: 400, statusText: 'Bad Request' }
					);
				}
			}
		),
		/Pinpoint job creation failed: 400 Bad Request - Folder does not exist/
	);

	assert.deepEqual(urls, ['/api/observatory/astro/pinpoint']);

	await assert.rejects(
		getPinpointJobStatus('/astro/pinpoint/gone', {
			fetch: async () =>
				Response.json({ detail: 'Unknown job' }, { status: 404, statusText: 'Not Found' })
		}),
		/Pinpoint job status failed: 404 Not Found - Unknown job/
	);
});
