import assert from 'node:assert/strict';
import test from 'node:test';

import { getTelescopeDisplayState } from '../src/lib/telescopeState.js';

test('getTelescopeDisplayState reads nested telescope position and target coordinates', () => {
	const state = getTelescopeDisplayState({
		tracking: true,
		slewing: false,
		parked: false,
		position: {
			ra: '04:55:44.27',
			dec: '+22:36:51.85'
		},
		target: {
			ra: '04:55:44.38',
			dec: '+22:36:51.85'
		}
	});

	assert.deepEqual(state, {
		positionRa: '04:55:44.27',
		positionDec: '+22:36:51.85',
		targetRa: '04:55:44.38',
		targetDec: '+22:36:51.85',
		parked: false,
		slewing: false,
		tracking: true
	});
});

test('getTelescopeDisplayState falls back to flat coordinate keys', () => {
	const state = getTelescopeDisplayState({
		ra: '06:15:00.00',
		dec: '-12:30:00.00',
		is_parked: 'true',
		is_slewing: 'false',
		is_tracking: 'true'
	});

	assert.deepEqual(state, {
		positionRa: '06:15:00.00',
		positionDec: '-12:30:00.00',
		targetRa: null,
		targetDec: null,
		parked: true,
		slewing: false,
		tracking: true
	});
});
