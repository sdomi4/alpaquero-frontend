import { API_BASE } from '$env/static/private';
import type {
	ActionDefinition,
	ConditionDefinition,
	ConfiguredDevice
} from '$lib/sequence-builder/types';
import type { PageServerLoad } from './$types';

function backendUrl(path: string) {
	const base = API_BASE.endsWith('/') ? API_BASE : `${API_BASE}/`;
	return new URL(path.replace(/^\/+/, ''), base).toString();
}

export const load: PageServerLoad = async ({ fetch }) => {
	const [sequencesResponse, actionsResponse, conditionsResponse, devicesResponse] =
		await Promise.all([
			fetch(backendUrl('sequences')),
			fetch(backendUrl('observatory/actions')),
			fetch(backendUrl('observatory/conditions')),
			fetch(backendUrl('observatory/devices'))
		]);

	const sequencesPayload = sequencesResponse.ok
		? ((await sequencesResponse.json()) as { sequences?: unknown })
		: null;
	const actionsPayload = actionsResponse.ok
		? ((await actionsResponse.json()) as { actions?: unknown })
		: null;
	const conditionsPayload = conditionsResponse.ok
		? ((await conditionsResponse.json()) as { conditions?: unknown })
		: null;
	const devicesPayload = devicesResponse.ok ? await devicesResponse.json() : null;

	return {
		sequences: Array.isArray(sequencesPayload?.sequences)
			? sequencesPayload.sequences.map(String)
			: [],
		actions: Array.isArray(actionsPayload?.actions)
			? (actionsPayload.actions as ActionDefinition[])
			: [],
		conditions: Array.isArray(conditionsPayload?.conditions)
			? (conditionsPayload.conditions as ConditionDefinition[])
			: [],
		devices: Array.isArray(devicesPayload) ? (devicesPayload as ConfiguredDevice[]) : [],
		catalogError:
			!sequencesResponse.ok || !actionsResponse.ok || !conditionsResponse.ok || !devicesResponse.ok
				? 'Some sequence-authoring metadata could not be loaded from the backend.'
				: null
	};
};
