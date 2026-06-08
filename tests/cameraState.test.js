import assert from 'node:assert/strict';
import test from 'node:test';

import { getCameraDisplayState } from '../src/lib/cameraState.js';

test('getCameraDisplayState reads camera temperature and exposure progress', () => {
	assert.deepEqual(
		getCameraDisplayState({
			temperature: -7.25,
			target_temperature: -10,
			cooler_power: 42.5,
			percent_completed: 73.2,
			exposing: true
		}),
		{
			temperature: -7.25,
			targetTemperature: -10,
			coolerPower: 42.5,
			percentCompleted: 73.2,
			exposing: true
		}
	);
});

test('getCameraDisplayState clamps percent_completed and supports fallback names', () => {
	assert.deepEqual(
		getCameraDisplayState({
			ccd_temperature: '-4.5',
			setpoint: '-8',
			coolerPower: '101',
			percent_completed: 125,
			is_exposing: 'false'
		}),
		{
			temperature: -4.5,
			targetTemperature: -8,
			coolerPower: 100,
			percentCompleted: 100,
			exposing: false
		}
	);
});
