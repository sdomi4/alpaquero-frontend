import assert from 'node:assert/strict';
import test from 'node:test';

import { getObservingConditionsDisplayState } from '../src/lib/observingConditionsState.js';

test('getObservingConditionsDisplayState reads simulator condition values', () => {
	assert.deepEqual(
		getObservingConditionsDisplayState({
			sky_ambient: -32.62333333333331,
			ambient: 6.023333333333335,
			rain: 0,
			wind: 0.6731666666666696,
			daylight: 89.6666666666668,
			humidity: 52.3333333333334,
			dew_point: -3.0034197418313764,
			pressure: 1026.1000000000013
		}),
		{
			skyAmbient: -32.62333333333331,
			ambient: 6.023333333333335,
			rain: 0,
			wind: 0.6731666666666696,
			daylight: 89.6666666666668,
			humidity: 52.3333333333334,
			dewPoint: -3.0034197418313764,
			pressure: 1026.1000000000013,
			skyDelta: -38.64666666666665,
			dewPointSpread: 9.026753075164711
		}
	);
});

test('getObservingConditionsDisplayState supports camelCase fallbacks and nulls missing values', () => {
	assert.deepEqual(
		getObservingConditionsDisplayState({
			skyAmbient: '-20',
			ambientTemperature: '5',
			windSpeed: '2.5',
			dewPoint: '1'
		}),
		{
			skyAmbient: -20,
			ambient: 5,
			rain: null,
			wind: 2.5,
			daylight: null,
			humidity: null,
			dewPoint: 1,
			pressure: null,
			skyDelta: -25,
			dewPointSpread: 4
		}
	);
});
