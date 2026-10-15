import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTelescopeCommandRequest } from '../src/lib/api/telescopeRequests.js';

test('buildTelescopeCommandRequest builds safety-gated park requests', () => {
	assert.deepEqual(buildTelescopeCommandRequest('scope main', 'park', true), {
		path: '/api/observatory/telescope/scope%20main/park',
		init: {
			method: 'POST',
			headers: {
				'x-safety-override': 'true'
			}
		}
	});
});

test('buildTelescopeCommandRequest builds RA/Dec slew requests without safety header by default', () => {
	assert.deepEqual(
		buildTelescopeCommandRequest('telescope-1', 'slew', false, { ra: 12.345, dec: -45.6 }),
		{
			path: '/api/observatory/telescope/telescope-1/slew',
			init: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ra: 12.345, dec: -45.6 })
			}
		}
	);
});

test('buildTelescopeCommandRequest builds slew-to-sun requests', () => {
	assert.deepEqual(buildTelescopeCommandRequest('solar scope', 'sun', true), {
		path: '/api/observatory/telescope/solar%20scope/slew/sun',
		init: {
			method: 'POST',
			headers: {
				'x-safety-override': 'true'
			}
		}
	});
});

test('slew submits raw input without client conversion or validation', () => {
	for (const coordinates of [
		{ ra: '18h04m20.99s', dec: '-29:31:08.9' },
		{ ra: 'J180420.99-293108.9', dec: '' },
		{ ra: 'invalid', dec: '91' }
	]) {
		const request = buildTelescopeCommandRequest('scope', 'slew', true, coordinates);
		assert.ok(request.init.body);
		assert.deepEqual(JSON.parse(request.init.body), coordinates);
		assert.equal(request.init.headers['x-safety-override'], 'true');
	}
});
