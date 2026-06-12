import assert from 'node:assert/strict';
import test from 'node:test';

import { runObservatoryControlAction } from '../src/lib/observatoryControlActions.js';

/** @typedef {'startup' | 'shutdown' | 'emergency_halt'} ObservatoryAction */
/** @typedef {['sequence' | 'action', string]} Call */

test('runObservatoryControlAction starts startup and shutdown sequences', async () => {
	/** @type {Call[]} */
	const calls = [];
	const deps = {
		/** @param {string} sequenceName */
		runSequence: async (sequenceName) => calls.push(['sequence', sequenceName]),
		/** @param {ObservatoryAction} action */
		runObservatoryAction: async (action) => calls.push(['action', action])
	};

	await runObservatoryControlAction('startup', deps);
	await runObservatoryControlAction('shutdown', deps);

	assert.deepEqual(calls, [
		['sequence', 'startup'],
		['sequence', 'shutdown']
	]);
});

test('runObservatoryControlAction keeps emergency halt as an observatory action', async () => {
	/** @type {Call[]} */
	const calls = [];
	const deps = {
		/** @param {string} sequenceName */
		runSequence: async (sequenceName) => calls.push(['sequence', sequenceName]),
		/** @param {ObservatoryAction} action */
		runObservatoryAction: async (action) => calls.push(['action', action])
	};

	await runObservatoryControlAction('emergency_halt', deps);

	assert.deepEqual(calls, [['action', 'emergency_halt']]);
});
