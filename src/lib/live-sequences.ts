export type LiveSequenceNode = {
	id: string;
	name: string;
	type: string;
	lifecycle: Record<string, unknown>;
	children: LiveSequenceNode[];
};

export type LiveSequenceState = {
	context_id: string;
	sequence_name: string;
	status: string;
	info: string | null;
	steps: Record<string, number>;
};

export type LiveSequenceIndex = {
	root: LiveSequenceNode;
	byId: Map<string, LiveSequenceNode>;
	parentById: Map<string, string | null>;
};

export type LiveLifecycleEntry = {
	name: string;
	label: string;
	value: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isTreeBuildPending(value: unknown) {
	return isRecord(value) && value.status === 'No root sequence available.';
}

function isDefaultLifecycleValue(name: string, value: unknown) {
	if (name === 'repeat') return value === undefined || value === null || value === 1;
	if (value === undefined || value === null || value === false) return true;
	if (typeof value === 'number') return value === 0;
	if (typeof value === 'string') return value.trim() === '';
	if (Array.isArray(value)) return value.length === 0;
	if (isRecord(value)) return Object.keys(value).length === 0;
	return false;
}

function formatLifecycleValue(value: unknown) {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);

	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
}

export function nonDefaultLiveLifecycleEntries(
	lifecycle: Record<string, unknown>
): LiveLifecycleEntry[] {
	return Object.entries(lifecycle)
		.filter(([name, value]) => !isDefaultLifecycleValue(name, value))
		.map(([name, value]) => ({
			name,
			label: name.replaceAll('_', ' '),
			value: formatLifecycleValue(value)
		}));
}

export function parseLiveSequenceTree(value: unknown): LiveSequenceIndex {
	const byId = new Map<string, LiveSequenceNode>();
	const parentById = new Map<string, string | null>();

	function visit(raw: unknown, parentId: string | null): LiveSequenceNode {
		if (!isRecord(raw)) throw new Error('The live sequence tree contains an invalid node.');

		const id = typeof raw.id === 'string' ? raw.id : '';
		const name = typeof raw.name === 'string' ? raw.name : '';
		const type = typeof raw.type === 'string' ? raw.type : '';
		const rawChildren = Array.isArray(raw.children) ? raw.children : null;

		if (!id || !name || !type || rawChildren === null) {
			throw new Error('The live sequence tree is missing required node fields.');
		}

		if (byId.has(id)) throw new Error(`Duplicate live sequence step id: ${id}`);

		const node: LiveSequenceNode = {
			id,
			name,
			type,
			lifecycle: isRecord(raw.lifecycle) ? raw.lifecycle : {},
			children: []
		};

		byId.set(id, node);
		parentById.set(id, parentId);
		node.children = rawChildren.map((child) => visit(child, id));
		return node;
	}

	const root = visit(value, null);
	return { root, byId, parentById };
}

function addAncestors(index: LiveSequenceIndex, nodeId: string, visible: Set<string>) {
	let currentId: string | null | undefined = nodeId;

	while (currentId) {
		visible.add(currentId);
		currentId = index.parentById.get(currentId);
	}
}

function subtreeContainsActive(node: LiveSequenceNode, activeIds: Set<string>): boolean {
	return (
		activeIds.has(node.id) || node.children.some((child) => subtreeContainsActive(child, activeIds))
	);
}

/**
 * Returns the active execution path plus the immediate ordered neighbors of
 * every active child in a sequential container. Parallel branches are kept as
 * branches and are only included when activity reaches them.
 */
export function compactLiveNodeIds(index: LiveSequenceIndex, steps: Record<string, number>) {
	const activeIds = new Set(Object.keys(steps));
	const visible = new Set<string>([index.root.id]);

	for (const nodeId of activeIds) {
		if (index.byId.has(nodeId)) addAncestors(index, nodeId, visible);
	}

	for (const node of index.byId.values()) {
		if (node.type !== 'Sequence') continue;

		for (let indexInSequence = 0; indexInSequence < node.children.length; indexInSequence += 1) {
			if (!subtreeContainsActive(node.children[indexInSequence], activeIds)) continue;

			for (
				let neighborIndex = Math.max(0, indexInSequence - 1);
				neighborIndex <= Math.min(node.children.length - 1, indexInSequence + 1);
				neighborIndex += 1
			) {
				visible.add(node.children[neighborIndex].id);
			}
		}
	}

	return visible;
}
