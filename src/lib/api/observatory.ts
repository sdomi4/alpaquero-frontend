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

export async function runDeviceLifecycleAction(
	deviceType: string,
	deviceId: string,
	action: 'startup' | 'shutdown'
) {
	const endpoint = DEVICE_ENDPOINTS[deviceType];

	if (!endpoint) {
		throw new Error(`No endpoint mapping for device type "${deviceType}"`);
	}

	const res = await fetch(
		`${OBSERVATORY_API_BASE}/${endpoint}/${encodeURIComponent(deviceId)}/${action}`,
		{
			method: 'POST'
		}
	);

	if (!res.ok) {
		throw new Error(`${action} failed: ${res.status} ${res.statusText}`);
	}

	return res.json().catch(() => null);
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
