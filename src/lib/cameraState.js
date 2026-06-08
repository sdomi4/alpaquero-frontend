/**
 * @typedef {{
 *   temperature: number | null;
 *   targetTemperature: number | null;
 *   coolerPower: number | null;
 *   percentCompleted: number | null;
 *   exposing: boolean | null;
 * }} CameraDisplayState
 */

/**
 * @param {Record<string, unknown> | null | undefined} state
 * @returns {CameraDisplayState}
 */
export function getCameraDisplayState(state) {
	const source = state ?? {};
	const percentCompleted = clampPercent(
		firstNumber(source, ['percent_completed', 'percentCompleted', 'exposure_percent'])
	);
	const exposing =
		firstBoolean(source, ['exposing', 'is_exposing', 'exposure_in_progress']) ??
		inferExposingFromPercent(percentCompleted);

	return {
		temperature: firstNumber(source, [
			'temperature',
			'ccd_temperature',
			'sensor_temperature',
			'camera_temperature'
		]),
		targetTemperature: firstNumber(source, [
			'target_temperature',
			'targetTemperature',
			'setpoint',
			'temperature_setpoint'
		]),
		coolerPower: clampPercent(firstNumber(source, ['cooler_power', 'coolerPower', 'cooler'])),
		percentCompleted,
		exposing
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
 * @param {Record<string, unknown>} source
 * @param {string[]} keys
 */
function firstBoolean(source, keys) {
	for (const key of keys) {
		const value = source[key];

		if (typeof value === 'boolean') return value;
		if (typeof value === 'string') {
			const normalized = value.trim().toLowerCase();
			if (normalized === 'true') return true;
			if (normalized === 'false') return false;
		}
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

/**
 * @param {number | null} value
 */
function inferExposingFromPercent(value) {
	if (value === null) return null;
	return value > 0 && value < 100;
}
