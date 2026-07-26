import { parse, stringify } from 'yaml';
import type {
	ActionNode,
	ExtraYamlFields,
	Lifecycle,
	ParallelNode,
	PauseNode,
	SequenceBlock,
	SequenceDocument,
	SequenceNode,
	YamlValue
} from './types';

type YamlRecord = Record<string, unknown>;

const LIFECYCLE_KEYS = [
	'delay',
	'repeat',
	'when',
	'await',
	'await_timeout',
	'until',
	'update'
] as const;
const TOP_LEVEL_KEYS = new Set(['name', 'description', 'sequence', ...LIFECYCLE_KEYS]);
const NODE_KEYS = {
	sequence: new Set(['name', 'sequence', ...LIFECYCLE_KEYS]),
	parallel: new Set(['name', 'parallel', ...LIFECYCLE_KEYS]),
	pause: new Set(['name', 'pause', 'reason']),
	action: new Set(['name', 'action', 'device', 'device_id', 'args', 'register', ...LIFECYCLE_KEYS])
};

function humanizeIdentifier(value: string) {
	return value
		.replaceAll('_', ' ')
		.replace(/\b\w/g, (character) => character.toUpperCase())
		.trim();
}

export class SequenceYamlError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SequenceYamlError';
	}
}

function isRecord(value: unknown): value is YamlRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asYamlValue(value: unknown, path: string): YamlValue {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((item, index) => asYamlValue(item, `${path}[${index}]`));
	}

	if (isRecord(value)) {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, asYamlValue(item, `${path}.${key}`)])
		);
	}

	throw new SequenceYamlError(`${path} contains a value that cannot be represented in YAML.`);
}

function extraFields(record: YamlRecord, knownKeys: Set<string>, path: string) {
	const entries = Object.entries(record)
		.filter(([key]) => !knownKeys.has(key))
		.map(([key, value]) => [key, asYamlValue(value, `${path}.${key}`)]);

	return entries.length > 0 ? (Object.fromEntries(entries) as ExtraYamlFields) : undefined;
}

function optionalString(value: unknown, path: string) {
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'string') throw new SequenceYamlError(`${path} must be a string.`);
	return value;
}

function requiredString(value: unknown, path: string) {
	const result = optionalString(value, path);
	if (!result?.trim()) throw new SequenceYamlError(`${path} must be a non-empty string.`);
	return result;
}

function lifecycle(record: YamlRecord, path: string): Lifecycle {
	const result: Lifecycle = {};

	if (record.delay !== undefined) {
		if (typeof record.delay !== 'number' || !Number.isFinite(record.delay)) {
			throw new SequenceYamlError(`${path}.delay must be a number.`);
		}
		result.delay = record.delay;
	}

	if (record.repeat !== undefined) {
		if (typeof record.repeat !== 'number' || !Number.isInteger(record.repeat)) {
			throw new SequenceYamlError(`${path}.repeat must be an integer.`);
		}
		result.repeat = record.repeat;
	}

	if (record.when !== undefined) {
		result.when = requiredString(record.when, `${path}.when`);
	}

	if (record.await !== undefined) {
		result.await = requiredString(record.await, `${path}.await`);
	}

	if (record.await_timeout !== undefined) {
		if (typeof record.await_timeout !== 'number' || !Number.isFinite(record.await_timeout)) {
			throw new SequenceYamlError(`${path}.await_timeout must be a number.`);
		}
		result.await_timeout = record.await_timeout;
	}

	if (record.until !== undefined) {
		result.until = requiredString(record.until, `${path}.until`);
	}

	if (record.update !== undefined) {
		if (typeof record.update !== 'boolean') {
			throw new SequenceYamlError(`${path}.update must be a boolean.`);
		}
		result.update = record.update;
	}

	return result;
}

function createIdFactory() {
	let value = 0;
	return (type: SequenceBlock['type'] | 'document') => `${type}-${++value}`;
}

function parseArgs(value: unknown, path: string) {
	if (value === undefined || value === null) return {};
	if (!isRecord(value)) throw new SequenceYamlError(`${path} must be a mapping.`);

	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, asYamlValue(item, `${path}.${key}`)])
	);
}

function parseNode(
	value: unknown,
	path: string,
	nextId: ReturnType<typeof createIdFactory>
): SequenceBlock {
	if (!isRecord(value)) throw new SequenceYamlError(`${path} must be a mapping.`);

	const discriminators = ['sequence', 'parallel', 'pause', 'action'].filter((key) => key in value);
	if (discriminators.length !== 1) {
		throw new SequenceYamlError(
			`${path} must contain exactly one of sequence, parallel, pause, or action.`
		);
	}

	if ('sequence' in value) {
		if (!Array.isArray(value.sequence)) {
			throw new SequenceYamlError(`${path}.sequence must be an array.`);
		}
		const node: SequenceNode = {
			id: nextId('sequence'),
			type: 'sequence',
			name: optionalString(value.name, `${path}.name`) || 'Unnamed Sequence',
			children: value.sequence.map((child, index) =>
				parseNode(child, `${path}.sequence[${index}]`, nextId)
			),
			...lifecycle(value, path),
			extra: extraFields(value, NODE_KEYS.sequence, path)
		};
		return node;
	}

	if ('parallel' in value) {
		if (!Array.isArray(value.parallel)) {
			throw new SequenceYamlError(`${path}.parallel must be an array.`);
		}
		const node: ParallelNode = {
			id: nextId('parallel'),
			type: 'parallel',
			name: optionalString(value.name, `${path}.name`) || 'Parallel Group',
			children: value.parallel.map((child, index) =>
				parseNode(child, `${path}.parallel[${index}]`, nextId)
			),
			...lifecycle(value, path),
			extra: extraFields(value, NODE_KEYS.parallel, path)
		};
		return node;
	}

	if ('pause' in value) {
		if (value.pause !== true) throw new SequenceYamlError(`${path}.pause must be true.`);
		const node: PauseNode = {
			id: nextId('pause'),
			type: 'pause',
			name: optionalString(value.name, `${path}.name`) || 'Pause',
			reason: optionalString(value.reason, `${path}.reason`),
			extra: extraFields(value, NODE_KEYS.pause, path)
		};
		return node;
	}

	const action = requiredString(value.action, `${path}.action`);
	const args = parseArgs(value.args, `${path}.args`);
	const argsDevice =
		typeof args.device === 'string'
			? args.device
			: typeof args.device_id === 'string'
				? args.device_id
				: undefined;
	const device =
		optionalString(value.device, `${path}.device`) ??
		optionalString(value.device_id, `${path}.device_id`) ??
		argsDevice;

	if (argsDevice) {
		delete args.device;
		delete args.device_id;
	}

	const node: ActionNode = {
		id: nextId('action'),
		type: 'action',
		action,
		label: optionalString(value.name, `${path}.name`) || humanizeIdentifier(action),
		device,
		args,
		register: optionalString(value.register, `${path}.register`),
		estimatedDurationSeconds: 0,
		...lifecycle(value, path),
		extra: extraFields(value, NODE_KEYS.action, path)
	};
	return node;
}

export function parseSequenceYaml(source: string): SequenceDocument {
	let parsed: unknown;
	try {
		parsed = parse(source);
	} catch (error) {
		throw new SequenceYamlError(error instanceof Error ? error.message : 'Invalid YAML document.');
	}

	if (!isRecord(parsed)) throw new SequenceYamlError('The YAML document must be a mapping.');
	const name = requiredString(parsed.name, 'name');
	if (!Array.isArray(parsed.sequence)) {
		throw new SequenceYamlError('The top-level sequence must be an array.');
	}

	const nextId = createIdFactory();
	const root: SequenceNode = {
		id: nextId('sequence'),
		type: 'sequence',
		name,
		children: parsed.sequence.map((child, index) => parseNode(child, `sequence[${index}]`, nextId)),
		...lifecycle(parsed, 'document')
	};

	return {
		id: nextId('document'),
		name,
		description: optionalString(parsed.description, 'description'),
		root,
		version: 1,
		extra: extraFields(parsed, TOP_LEVEL_KEYS, 'document')
	};
}

function lifecycleYaml(node: Lifecycle) {
	return {
		...(node.delay !== undefined ? { delay: node.delay } : {}),
		...(node.repeat !== undefined ? { repeat: node.repeat } : {}),
		...(node.when !== undefined ? { when: node.when } : {}),
		...(node.await !== undefined ? { await: node.await } : {}),
		...(node.await_timeout !== undefined ? { await_timeout: node.await_timeout } : {}),
		...(node.until !== undefined ? { until: node.until } : {}),
		...(node.update !== undefined ? { update: node.update } : {})
	};
}

function serializeNode(node: SequenceBlock): Record<string, YamlValue> {
	if (node.type === 'sequence') {
		return {
			...(node.extra ?? {}),
			name: node.name,
			sequence: node.children.map(serializeNode),
			...lifecycleYaml(node)
		};
	}

	if (node.type === 'parallel') {
		return {
			...(node.extra ?? {}),
			name: node.name,
			parallel: node.children.map(serializeNode),
			...lifecycleYaml(node)
		};
	}

	if (node.type === 'pause') {
		return {
			...(node.extra ?? {}),
			name: node.name,
			pause: true,
			...(node.reason ? { reason: node.reason } : {})
		};
	}

	return {
		...(node.extra ?? {}),
		...(node.label && node.label !== humanizeIdentifier(node.action) ? { name: node.label } : {}),
		action: node.action,
		...(node.device ? { device: node.device } : {}),
		...(Object.keys(node.args).length > 0 ? { args: node.args } : {}),
		...(node.register ? { register: node.register } : {}),
		...lifecycleYaml(node)
	};
}

export function serializeSequenceYaml(document: SequenceDocument) {
	const yamlDocument: Record<string, YamlValue> = {
		...(document.extra ?? {}),
		name: document.name,
		...(document.description ? { description: document.description } : {}),
		sequence: document.root.children.map(serializeNode),
		...lifecycleYaml(document.root)
	};

	return stringify(yamlDocument, { indent: 2, lineWidth: 0 });
}

export function sequenceYamlFilename(name: string) {
	const stem =
		name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'sequence';
	return `${stem}.yaml`;
}
