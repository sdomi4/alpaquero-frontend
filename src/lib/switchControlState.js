/**
 * @param {unknown} raw
 * @returns {number | undefined}
 */
function numericSwitchValue(raw) {
	if (typeof raw === 'boolean') return raw ? 1 : 0;
	if (typeof raw === 'number') return raw;

	if (raw && typeof raw === 'object' && 'value' in raw) {
		return numericSwitchValue(raw.value);
	}

	return undefined;
}

/**
 * @typedef {{ id: number, key: string, label: string, value: boolean | number, control_type: 'toggle' | 'range', min_value?: number }} SwitchControlLike
 */

/**
 * Reads a control from both switch-state formats used by observatory backends:
 * keyed objects and arrays. Scalar entries are supported as well as full
 * control records.
 *
 * @param {Record<string, unknown> | null | undefined} state
 * @param {SwitchControlLike} control
 * @returns {number | undefined}
 */
export function switchStateControlValue(state, control) {
	const controls = state?.controls;
	let match;

	if (Array.isArray(controls)) {
		match = controls.find((raw) => {
			if (!raw || typeof raw !== 'object') return false;
			const record = /** @type {Record<string, unknown>} */ (raw);

			return (
				Number(record.id ?? record.number) === control.id ||
				record.key === control.key ||
				record.label === control.label ||
				record.name === control.label
			);
		});
	} else if (controls && typeof controls === 'object') {
		const records = /** @type {Record<string, unknown>} */ (controls);
		match = records[control.key] ?? records[control.label] ?? records[String(control.id)];

		if (match === undefined) {
			match = Object.values(records).find((raw) => {
				if (!raw || typeof raw !== 'object') return false;
				return Number(/** @type {Record<string, unknown>} */ (raw).id) === control.id;
			});
		}
	}

	const nestedValue = numericSwitchValue(match);
	if (nestedValue !== undefined) return nestedValue;

	return numericSwitchValue(
		state?.[control.key] ??
			state?.[control.label] ??
			state?.[`switch_${control.id}`] ??
			state?.[String(control.id)]
	);
}

/**
 * @param {Record<string, unknown> | null | undefined} state
 * @param {SwitchControlLike} control
 * @param {Record<number, number>} localValues
 */
export function displayedSwitchControlValue(state, control, localValues) {
	const localValue = localValues[control.id];
	if (typeof localValue === 'number') return localValue;

	const stateValue = switchStateControlValue(state, control);
	if (stateValue !== undefined) return stateValue;

	const controlValue = numericSwitchValue(control.value);
	if (controlValue !== undefined) return controlValue;

	return control.control_type === 'toggle' ? 0 : (control.min_value ?? 0);
}
