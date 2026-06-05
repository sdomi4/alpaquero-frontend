import assert from 'node:assert/strict';
import test from 'node:test';

import { getTelescopeDisplayState } from '../src/lib/telescopeState.js';

test('getTelescopeDisplayState reads nested telescope position and target coordinates', () => {
	const state = getTelescopeDisplayState({
		tracking: true,
		slewing: false,
		parked: false,
		position: {
			ra: 4.928962822509298,
			dec: 22.614403455568937
		},
		target: {
			ra: 4.92899341488601,
			dec: 22.614403455568937
		}
	});

	assert.deepEqual(state, {
		positionRa: 4.928962822509298,
		positionDec: 22.614403455568937,
		targetRa: 4.92899341488601,
		targetDec: 22.614403455568937,
		parked: false,
		slewing: false,
		tracking: true
	});
});

test('getTelescopeDisplayState falls back to flat coordinate keys', () => {
	const state = getTelescopeDisplayState({
		ra: '6.25',
		dec: '-12.5',
		is_parked: 'true',
		is_slewing: 'false',
		is_tracking: 'true'
	});

	assert.deepEqual(state, {
		positionRa: 6.25,
		positionDec: -12.5,
		targetRa: null,
		targetDec: null,
		parked: true,
		slewing: false,
		tracking: true
	});
});
