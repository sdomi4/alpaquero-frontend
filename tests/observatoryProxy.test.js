import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBackendUrl, proxyObservatoryRequest } from '../src/lib/server/observatoryProxy.js';

test('buildBackendUrl appends proxied path and search to the backend base', () => {
	const url = buildBackendUrl(
		'http://localhost:8000/api/',
		'cover/main%20cover/open',
		'?dry_run=true'
	);

	assert.equal(url, 'http://localhost:8000/api/cover/main%20cover/open?dry_run=true');
});

test('proxyObservatoryRequest forwards method, headers, and body to the backend', async () => {
	/** @type {Array<{ url: string; method: string | undefined; headers: Record<string, string>; body: string }>} */
	const calls = [];
	const request = new Request('http://frontend.test/api/observatory/dome/dome-1/open?safety=true', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-safety-override': 'true'
		},
		body: JSON.stringify({ ok: true })
	});

	const response = await proxyObservatoryRequest({
		apiBase: 'http://backend.test',
		path: 'dome/dome-1/open',
		request,
		/** @type {typeof globalThis.fetch} */
		fetch: async (url, init) => {
			calls.push({
				url: String(url),
				method: init?.method,
				headers: Object.fromEntries(new Headers(init?.headers)),
				body: await new Response(init?.body).text()
			});

			return new Response(JSON.stringify({ forwarded: true }), {
				status: 202,
				headers: {
					'content-type': 'application/json',
					'x-backend-request': 'accepted'
				}
			});
		}
	});

	assert.equal(response.status, 202);
	assert.equal(response.headers.get('content-type'), 'application/json');
	assert.equal(response.headers.get('x-backend-request'), 'accepted');
	assert.deepEqual(calls, [
		{
			url: 'http://backend.test/dome/dome-1/open?safety=true',
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-safety-override': 'true'
			},
			body: '{"ok":true}'
		}
	]);
	assert.deepEqual(await response.json(), { forwarded: true });
});

test('proxyObservatoryRequest lets fetch calculate content length for forwarded bodies', async () => {
	/** @type {Array<Record<string, string>>} */
	const forwardedHeaders = [];
	const request = new Request('http://frontend.test/api/observatory/observatory/sequences/parse', {
		method: 'POST',
		headers: {
			'content-length': '999',
			'content-type': 'multipart/form-data; boundary=----manual-sequence-upload'
		},
		body:
			'------manual-sequence-upload\r\n' +
			'content-disposition: form-data; name="file"; filename="sequence.yaml"\r\n' +
			'content-type: application/yaml\r\n\r\n' +
			'name: test\r\n' +
			'------manual-sequence-upload--\r\n'
	});

	await proxyObservatoryRequest({
		apiBase: 'http://backend.test',
		path: 'observatory/sequences/parse',
		request,
		/** @type {typeof globalThis.fetch} */
		fetch: async (_url, init) => {
			forwardedHeaders.push(Object.fromEntries(new Headers(init?.headers)));

			return new Response(null, { status: 204 });
		}
	});

	assert.equal(forwardedHeaders[0]['content-length'], undefined);
	assert.equal(
		forwardedHeaders[0]['content-type'],
		'multipart/form-data; boundary=----manual-sequence-upload'
	);
});
