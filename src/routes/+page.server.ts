import { API_BASE } from '$env/static/private';
import type { PageServerLoad } from './$types';

export type ConfiguredDevice = {
	type: string;
	id: string;
	name: string;
};

function backendUrl(path: string) {
	const base = API_BASE.endsWith('/') ? API_BASE : `${API_BASE}/`;
	return new URL(path.replace(/^\/+/, ''), base).toString();
}

export const load: PageServerLoad = async ({ fetch }) => {
	const [devicesRes, sequencesRes] = await Promise.all([
		fetch(backendUrl('observatory/devices')),
		fetch(backendUrl('observatory/sequences'))
	]);

	return {
		devices: devicesRes.ok ? ((await devicesRes.json()) as ConfiguredDevice[]) : [],
		sequences: sequencesRes.ok ? await sequencesRes.json() : [],
		error: !devicesRes.ok
			? `Failed to load devices: ${devicesRes.status} ${devicesRes.statusText}`
			: null
	};
};
