const CONTROL_DEVICE_EXCLUDED_TYPES = new Set(['observing_conditions', 'safety_monitor']);

/**
 * @typedef {{
 *   id: string;
 *   type: string;
 *   name: string;
 * }} ConfiguredDevice
 *
 * @typedef {{
 *   id: string;
 *   type?: string;
 *   name?: string | null;
 *   connected: boolean;
 *   status?: string;
 *   state: Record<string, unknown>;
 * }} LiveDevice
 *
 * @typedef {ConfiguredDevice & {
 *   connected: boolean;
 *   status: string;
 *   state: Record<string, unknown> | null;
 *   live?: LiveDevice;
 * }} MergedDevice
 *
 * @typedef {{
 *   id: string;
 *   label: string;
 *   kind: 'controls' | 'switches';
 *   devices: MergedDevice[];
 * }} ControlTab
 *
 * @typedef {{
 *   id: string;
 *   label: string;
 *   kind: 'sequences' | 'observatory-actions' | 'device';
 *   deviceId?: string;
 * }} MobileControlOption
 */

/**
 * @param {ConfiguredDevice[]} devices
 * @param {Record<string, LiveDevice>} liveDevices
 * @returns {MergedDevice[]}
 */
export function mergeConfiguredDevices(devices, liveDevices) {
	return devices.map((device) => {
		const live = liveDevices[device.id];
		const connected = Boolean(live?.connected);

		return {
			...device,
			connected,
			status: connected ? (live?.status ?? 'unknown') : 'disconnected',
			state: connected ? live?.state : null,
			live
		};
	});
}

/**
 * @param {MergedDevice[] | ConfiguredDevice[]} devices
 */
export function getControlDevices(devices) {
	return devices.filter((device) => !CONTROL_DEVICE_EXCLUDED_TYPES.has(device.type));
}

/**
 * @param {MergedDevice[]} controlDevices
 * @param {number} [controlsPerPage]
 * @returns {ControlTab[]}
 */
export function createControlTabs(controlDevices, controlsPerPage = 4) {
	const switchDevices = controlDevices.filter((device) => device.type === 'switch');
	const nonSwitchControlDevices = controlDevices.filter((device) => device.type !== 'switch');
	const tabs = /** @type {ControlTab[]} */ ([]);

	if (nonSwitchControlDevices.length > 0) {
		const pageCount = Math.ceil(nonSwitchControlDevices.length / controlsPerPage);

		for (let index = 0; index < pageCount; index += 1) {
			tabs.push({
				id: `controls-${index + 1}`,
				label: pageCount === 1 ? 'Controls' : `Controls ${index + 1}`,
				kind: 'controls',
				devices: nonSwitchControlDevices.slice(
					index * controlsPerPage,
					(index + 1) * controlsPerPage
				)
			});
		}
	}

	if (switchDevices.length > 0) {
		tabs.push({
			id: 'switches',
			label: 'Switches',
			kind: 'switches',
			devices: switchDevices
		});
	}

	return tabs;
}

/**
 * @param {MergedDevice[] | ConfiguredDevice[]} devices
 * @returns {MobileControlOption[]}
 */
export function createMobileControlOptions(devices) {
	return [
		{ id: 'sequences', label: 'Sequences', kind: 'sequences' },
		{ id: 'observatory-actions', label: 'Observatory Actions', kind: 'observatory-actions' },
		...getControlDevices(devices).map(
			(device) =>
				/** @type {MobileControlOption} */ ({
					id: `device:${device.id}`,
					label: device.name || device.id,
					kind: 'device',
					deviceId: device.id
				})
		)
	];
}
