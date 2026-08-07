import { API_BASE } from '$env/static/private';
import type { PageServerLoad } from './$types';

export type ConfiguredDevice = {
	type: string;
	id: string;
	name: string;
};

export type ConfiguredCamera = string | { id?: string; name?: string; camera_name?: string };

export type ConfiguredInstrument = {
	id: string;
	name: string;
	devices: Array<Record<string, string>>;
};

export type ConfiguredLivestreams = Record<string, string> | null;

function backendUrl(path: string) {
	const base = API_BASE.endsWith('/') ? API_BASE : `${API_BASE}/`;
	return new URL(path.replace(/^\/+/, ''), base).toString();
}

export const load: PageServerLoad = async ({ fetch }) => {
	const [devicesRes, sequencesRes, camerasRes, instrumentsRes, livestreamsRes] = await Promise.all([
		fetch(backendUrl('observatory/devices')),
		fetch(backendUrl('sequences')),
		fetch(backendUrl('observatory/cameras')),
		fetch(backendUrl('observatory/instruments')),
		fetch(backendUrl('livestreams'))
	]);

	return {
		devices: devicesRes.ok ? ((await devicesRes.json()) as ConfiguredDevice[]) : [],
		sequences: sequencesRes.ok ? await sequencesRes.json() : [],
		cameras: camerasRes.ok ? ((await camerasRes.json()) as ConfiguredCamera[]) : [],
		instruments: instrumentsRes.ok ? ((await instrumentsRes.json()) as ConfiguredInstrument[]) : [],
		livestreams: livestreamsRes.ok
			? ((await livestreamsRes.json()) as ConfiguredLivestreams)
			: undefined,
		error: !devicesRes.ok
			? `Failed to load devices: ${devicesRes.status} ${devicesRes.statusText}`
			: null
	};
};
