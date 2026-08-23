import assert from 'node:assert/strict';
import test from 'node:test';
import {
	displayedSwitchControlValue,
	switchStateControlValue
} from '../src/lib/switchControlState.js';

/** @type {import('../src/lib/switchControlState.js').SwitchControlLike} */
const powerControl = {
	id: 1,
	key: 'Power2',
	label: 'Power2',
	value: false,
	control_type: 'toggle'
};

test('a successful local switch value bridges the gap until live state catches up', () => {
	const staleState = { controls: { Power2: { id: 1, value: false } } };

	assert.equal(displayedSwitchControlValue(staleState, powerControl, { 1: 1 }), 1);
	assert.equal(displayedSwitchControlValue(staleState, powerControl, {}), 0);
});

test('switch state values are resolved independently by control id', () => {
	const state = {
		controls: {
			first: { id: 0, value: true },
			second: { id: 1, value: false }
		}
	};

	assert.equal(switchStateControlValue(state, { ...powerControl, id: 0 }), 1);
	assert.equal(switchStateControlValue(state, powerControl), 0);
});

test('array and scalar switch-state formats remain authoritative', () => {
	assert.equal(
		switchStateControlValue(
			{ controls: [{ number: 1, name: 'Power2', value: true }] },
			powerControl
		),
		1
	);
	assert.equal(switchStateControlValue({ controls: { Power2: false } }, powerControl), 0);
});
