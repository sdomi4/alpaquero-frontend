import assert from 'node:assert/strict';
import test from 'node:test';

import { createMobileControlOptions, mergeConfiguredDevices } from '../src/lib/controlModel.js';

test('mergeConfiguredDevices overlays live device status without losing configured devices', () => {
	const devices = [
		{ id: 'cam1', name: 'Camera', type: 'camera' },
		{ id: 'mount', name: 'Mount', type: 'telescope' }
	];

	assert.deepEqual(
		mergeConfiguredDevices(devices, {
			mount: {
				id: 'mount',
				type: 'telescope',
				name: 'Live Mount',
				connected: true,
				status: 'tracking',
				state: { tracking: true }
			}
		}),
		[
			{
				id: 'cam1',
				name: 'Camera',
				type: 'camera',
				connected: false,
				status: 'disconnected',
				state: null,
				live: undefined
			},
			{
				id: 'mount',
				name: 'Mount',
				type: 'telescope',
				connected: true,
				status: 'tracking',
				state: { tracking: true },
				live: {
					id: 'mount',
					type: 'telescope',
					name: 'Live Mount',
					connected: true,
					status: 'tracking',
					state: { tracking: true }
				}
			}
		]
	);
});

test('createMobileControlOptions includes sequences, observatory actions, and every control device', () => {
	const devices = [
		{ id: 'conditions', name: 'Conditions', type: 'observing_conditions' },
		{ id: 'safety', name: 'Safety', type: 'safety_monitor' },
		{ id: 'mount', name: 'Mount', type: 'telescope' },
		{ id: 'filter', name: 'Filter Wheel', type: 'filterwheel' },
		{ id: 'flat', name: 'Flat Panel', type: 'cover' },
		{ id: 'power', name: 'Power Box', type: 'switch' }
	];

	assert.deepEqual(createMobileControlOptions(devices), [
		{ id: 'sequences', label: 'Sequences', kind: 'sequences' },
		{ id: 'observatory-actions', label: 'Observatory Actions', kind: 'observatory-actions' },
		{ id: 'device:mount', label: 'Mount', kind: 'device', deviceId: 'mount' },
		{ id: 'device:filter', label: 'Filter Wheel', kind: 'device', deviceId: 'filter' },
		{ id: 'device:flat', label: 'Flat Panel', kind: 'device', deviceId: 'flat' },
		{ id: 'device:power', label: 'Power Box', kind: 'device', deviceId: 'power' }
	]);
});
