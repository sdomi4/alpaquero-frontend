import assert from 'node:assert/strict';
import test from 'node:test';

import { uploadSequenceYaml } from '../src/lib/api/observatory.ts';

test('uploadSequenceYaml forwards dry-run and durable-save options', async () => {
	const originalFetch = globalThis.fetch;
	/** @type {Array<{ url: string; body: unknown }>} */
	const calls = [];

	globalThis.fetch = async (url, init) => {
		calls.push({
			url: String(url),
			body: JSON.parse(String(init?.body))
		});
		return new Response(JSON.stringify({ status: 'parsed' }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	};

	try {
		await uploadSequenceYaml('feature.yaml', 'name: feature\nsequence: []\n', false, true);
	} finally {
		globalThis.fetch = originalFetch;
	}

	assert.deepEqual(calls, [
		{
			url: '/api/observatory/sequences/parse?dry_run=false&save=true',
			body: {
				filename: 'feature.yaml',
				contentType: 'application/x-yaml',
				content: 'name: feature\nsequence: []\n'
			}
		}
	]);
});
