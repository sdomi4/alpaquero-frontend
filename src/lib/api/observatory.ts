import { buildCameraCommandRequest } from './cameraRequests.js';
import { buildTelescopeCommandRequest } from './telescopeRequests.js';

const OBSERVATORY_API_BASE = '/api/observatory';

const DEVICE_ENDPOINTS: Record<string, string> = {
	dome: 'dome',
	telescope: 'telescope',
	camera: 'camera',
	cover: 'cover',
	filterwheel: 'filterwheel',
	switch: 'switch',
	observing_conditions: 'conditions',
	safety_monitor: 'safety'
};

const OBSERVATORY_ACTION_PATHS: Record<ObservatoryAction, string[]> = {
	startup: ['observatory/startup', 'observatory/devices/startup'],
	shutdown: ['observatory/shutdown', 'observatory/devices/shutdown'],
	emergency_halt: [
		'observatory/emergency-halt',
		'observatory/emergency_halt',
		'observatory/emergency-stop',
		'observatory/halt'
	]
};

export type ObservatoryAction = 'startup' | 'shutdown' | 'emergency_halt';

export async function runObservatoryAction(action: ObservatoryAction) {
	const paths = OBSERVATORY_ACTION_PATHS[action];
	let lastResponse: Response | null = null;

	for (const path of paths) {
		const res = await postObservatoryPath(path);

		if (res.ok) {
			return res.json().catch(() => null);
		}

		lastResponse = res;

		if (res.status !== 404) break;
	}

	throw new Error(
		`${action.replace('_', ' ')} failed: ${lastResponse?.status ?? 'unknown'} ${lastResponse?.statusText ?? ''}`.trim()
	);
}

export async function runDeviceLifecycleAction(
	deviceType: string,
	deviceId: string,
	action: 'startup' | 'shutdown'
) {
	const endpoint = DEVICE_ENDPOINTS[deviceType];

	if (!endpoint) {
		throw new Error(`No endpoint mapping for device type "${deviceType}"`);
	}

	const primaryPath = `${endpoint}/${encodeURIComponent(deviceId)}/${action}`;
	const res = await postObservatoryPath(primaryPath);

	if (!res.ok && res.status === 404 && deviceType === 'switch') {
		const fallbackRes = await postObservatoryPath(
			`observatory/devices/${encodeURIComponent(deviceId)}/${action}`
		);

		if (fallbackRes.ok) {
			return fallbackRes.json().catch(() => null);
		}

		throw new Error(`${action} failed: ${fallbackRes.status} ${fallbackRes.statusText}`);
	}

	if (!res.ok) {
		throw new Error(`${action} failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

function postObservatoryPath(path: string) {
	return fetch(`${OBSERVATORY_API_BASE}/${path}`, {
		method: 'POST'
	});
}

export async function moveFilterWheel(filterwheelId: string, position: number) {
	const res = await fetch(
		`${OBSERVATORY_API_BASE}/filterwheel/${encodeURIComponent(filterwheelId)}/move/${position}`,
		{
			method: 'POST'
		}
	);

	if (!res.ok) {
		throw new Error(`Filter wheel move failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

async function runCameraCommand(
	cameraId: string,
	command: 'temperature' | 'capture',
	options: {
		targetTemp?: number;
		exposure?: number;
		binX?: number;
		binY?: number;
		additional_headers?: Record<string, unknown>;
	}
) {
	const request = buildCameraCommandRequest(cameraId, command, options);
	const res = await fetch(request.path, request.init);

	if (!res.ok) {
		throw new Error(`Camera ${command} failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export async function setCameraTemperature(cameraId: string, targetTemp: number) {
	return runCameraCommand(cameraId, 'temperature', { targetTemp });
}

export async function captureCameraImage(
	cameraId: string,
	exposure: number,
	binX = 1,
	binY = 1,
) {
	return runCameraCommand(cameraId, 'capture', {
		exposure,
		binX,
		binY,
	});
}

async function runTelescopeCommand(
	telescopeId: string,
	command: 'park' | 'unpark' | 'slew' | 'sun',
	safetyOverride = false,
	coordinates?: { ra: number; dec: number }
) {
	const request = buildTelescopeCommandRequest(telescopeId, command, safetyOverride, coordinates);
	const res = await fetch(request.path, request.init);

	if (!res.ok) {
		throw new Error(`Telescope ${command} failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export async function parkTelescope(telescopeId: string, safetyOverride = false) {
	return runTelescopeCommand(telescopeId, 'park', safetyOverride);
}

export async function unparkTelescope(telescopeId: string, safetyOverride = false) {
	return runTelescopeCommand(telescopeId, 'unpark', safetyOverride);
}

export async function slewTelescope(
	telescopeId: string,
	ra: number,
	dec: number,
	safetyOverride = false
) {
	return runTelescopeCommand(telescopeId, 'slew', safetyOverride, { ra, dec });
}

export async function slewTelescopeToSun(telescopeId: string, safetyOverride = false) {
	return runTelescopeCommand(telescopeId, 'sun', safetyOverride);
}

export async function runSequence(sequenceName: string) {
	const res = await fetch(
		`${OBSERVATORY_API_BASE}/observatory/sequences/${encodeURIComponent(sequenceName)}/run`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(null)
		}
	);

	if (!res.ok) {
		throw new Error(`Sequence start failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export async function pauseSequence(contextId: string) {
	const res = await fetch(
		`${OBSERVATORY_API_BASE}/observatory/sequences/${encodeURIComponent(contextId)}/pause`,
		{
			method: 'POST'
		}
	);

	if (!res.ok) {
		throw new Error(`Sequence pause failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export async function resumeSequence(contextId: string) {
	const res = await fetch(
		`${OBSERVATORY_API_BASE}/observatory/sequences/${encodeURIComponent(contextId)}/resume`,
		{
			method: 'POST'
		}
	);

	if (!res.ok) {
		throw new Error(`Sequence resume failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export async function abortSequence(contextId: string) {
	const res = await fetch(
		`${OBSERVATORY_API_BASE}/observatory/sequences/${encodeURIComponent(contextId)}/abort`,
		{
			method: 'POST'
		}
	);

	if (!res.ok) {
		throw new Error(`Sequence abort failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export async function uploadSequence(file: File, dryRun = false) {
	const form = new FormData();
	form.append('file', file);

	const res = await fetch(`${OBSERVATORY_API_BASE}/observatory/sequences/parse?dry_run=${dryRun}`, {
		method: 'POST',
		body: form
	});

	if (!res.ok) {
		throw new Error(`Sequence upload failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export async function listSequences() {
	const res = await fetch(`${OBSERVATORY_API_BASE}/observatory/sequences`);

	if (!res.ok) {
		throw new Error(`Sequence list failed: ${res.status} ${res.statusText}`);
	}

	return res.json();
}

export async function openDome(domeId: string, safetyOverride = false) {
	const headers: Record<string, string> = {};

	if (safetyOverride) {
		headers['x-safety-override'] = 'true';
	}

	const res = await fetch(`${OBSERVATORY_API_BASE}/dome/${encodeURIComponent(domeId)}/open`, {
		method: 'POST',
		headers
	});

	if (!res.ok) {
		throw new Error(`Dome open failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export async function closeDome(domeId: string, safetyOverride = false) {
	const headers: Record<string, string> = {};

	if (safetyOverride) {
		headers['x-safety-override'] = 'true';
	}

	const res = await fetch(`${OBSERVATORY_API_BASE}/dome/${encodeURIComponent(domeId)}/close`, {
		method: 'POST',
		headers
	});

	if (!res.ok) {
		throw new Error(`Dome close failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export async function openCover(coverId: string, safetyOverride = false) {
	const headers: Record<string, string> = {};

	if (safetyOverride) {
		headers['x-safety-override'] = 'true';
	}

	const res = await fetch(`${OBSERVATORY_API_BASE}/cover/${encodeURIComponent(coverId)}/open`, {
		method: 'POST',
		headers
	});

	if (!res.ok) {
		throw new Error(`Cover open failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export async function closeCover(coverId: string, safetyOverride = false) {
	const headers: Record<string, string> = {};

	if (safetyOverride) {
		headers['x-safety-override'] = 'true';
	}

	const res = await fetch(`${OBSERVATORY_API_BASE}/cover/${encodeURIComponent(coverId)}/close`, {
		method: 'POST',
		headers
	});

	if (!res.ok) {
		throw new Error(`Cover close failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export async function turnCalibratorOn(coverId: string, brightness: number) {
	const res = await fetch(
		`${OBSERVATORY_API_BASE}/cover/${encodeURIComponent(coverId)}/calibrator/on/${brightness}`,
		{
			method: 'POST'
		}
	);

	if (!res.ok) {
		throw new Error(`Calibrator on failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export async function turnCalibratorOff(coverId: string) {
	const res = await fetch(
		`${OBSERVATORY_API_BASE}/cover/${encodeURIComponent(coverId)}/calibrator/off`,
		{
			method: 'POST'
		}
	);

	if (!res.ok) {
		throw new Error(`Calibrator off failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}

export type SwitchControl = {
	number: number;
	name: string;
	description?: string | null;
	can_write?: boolean;
	state?: boolean;
};

export async function getSwitchControls(switchId: string) {
	const res = await fetch(
		`${OBSERVATORY_API_BASE}/switch/${encodeURIComponent(switchId)}/controls`
	);

	if (!res.ok) {
		throw new Error(`Switch controls failed: ${res.status} ${res.statusText}`);
	}

	return res.json();
}

export async function setSwitchControl(switchId: string, switchNumber: number, setting: number) {
	const res = await fetch(
		`${OBSERVATORY_API_BASE}/switch/${encodeURIComponent(switchId)}/${switchNumber}/${setting}`,
		{
			method: 'POST'
		}
	);

	if (!res.ok) {
		throw new Error(`Switch set failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
}
