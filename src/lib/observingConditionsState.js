/**
 * @typedef {{
 *   skyAmbient: number | null;
 *   ambient: number | null;
 *   rain: number | null;
 *   wind: number | null;
 *   daylight: number | null;
 *   humidity: number | null;
 *   dewPoint: number | null;
 *   pressure: number | null;
 *   skyDelta: number | null;
 *   dewPointSpread: number | null;
 * }} ObservingConditionsDisplayState
 */

/**
 * @param {Record<string, unknown> | null | undefined} state
 * @returns {ObservingConditionsDisplayState}
 */
export function getObservingConditionsDisplayState(state) {
	const source = state ?? {};
	const skyAmbient = firstNumber(source, ['sky_ambient', 'skyAmbient', 'sky_temperature']);
	const ambient = firstNumber(source, ['ambient', 'ambientTemperature', 'temperature']);
	const dewPoint = firstNumber(source, ['dew_point', 'dewPoint']);

	return {
		skyAmbient,
		ambient,
		rain: firstNumber(source, ['rain', 'rain_rate', 'rainRate']),
		wind: firstNumber(source, ['wind', 'wind_speed', 'windSpeed']),
		daylight: clampPercent(firstNumber(source, ['daylight', 'brightness', 'sky_brightness'])),
		humidity: clampPercent(
			firstNumber(source, ['humidity', 'relative_humidity', 'relativeHumidity'])
		),
		dewPoint,
		pressure: firstNumber(source, ['pressure', 'barometric_pressure', 'barometricPressure']),
		skyDelta: skyAmbient === null || ambient === null ? null : skyAmbient - ambient,
		dewPointSpread: ambient === null || dewPoint === null ? null : ambient - dewPoint
	};
}

/**
 * @param {Record<string, unknown>} source
 * @param {string[]} keys
 */
function firstNumber(source, keys) {
	for (const key of keys) {
		const value = source[key];
		const numberValue =
			typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

		if (Number.isFinite(numberValue)) return numberValue;
	}

	return null;
}

/**
 * @param {number | null} value
 */
function clampPercent(value) {
	if (value === null) return null;
	return Math.max(0, Math.min(100, value));
}
