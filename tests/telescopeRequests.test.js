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
			path: '/api/observatory/telescope/telescope-1/slew/12.345/-45.6',
			init: {
				method: 'POST',
				headers: {}
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
