import type {
	ActionDefinition,
	ActionNode,
	LibraryBlockType,
	ParallelNode,
	PauseNode,
	SequenceBlock,
	SequenceDocument,
	SequenceNode,
	SequenceSummary,
	YamlValue
} from './types';

export { validateSequence } from './validation.ts';

function createId(prefix: string) {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return `${prefix}-${crypto.randomUUID()}`;
	}

	return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function humanizeIdentifier(value: string) {
	return value
		.replaceAll('_', ' ')
		.replace(/\b\w/g, (character) => character.toUpperCase())
		.trim();
}

export function createBlock(
	type: LibraryBlockType,
	actionDefinition?: ActionDefinition
): SequenceBlock {
	if (type === 'action') {
		const action = actionDefinition?.name ?? 'debug_print';
		return {
			id: createId('action'),
			type: 'action',
			action,
			label: humanizeIdentifier(action),
			args: {},
			estimatedDurationSeconds: 0
		};
	}

	if (type === 'sequence') {
		return {
			id: createId('sequence'),
			type: 'sequence',
			name: 'Nested Sequence',
			children: []
		};
	}

	if (type === 'parallel') {
		return {
			id: createId('parallel'),
			type: 'parallel',
			name: 'Parallel Group',
			children: []
		};
	}

	return {
		id: createId('pause'),
		type: 'pause',
		name: 'Operator Checkpoint',
		reason: ''
	};
}

function childNodes(node: SequenceBlock): SequenceBlock[] {
	if (node.type === 'sequence' || node.type === 'parallel') return node.children;
	return [];
}

export function findNode(root: SequenceNode, nodeId: string): SequenceBlock | null {
	if (root.id === nodeId) return root;

	for (const child of root.children) {
		if (child.id === nodeId) return child;
		for (const descendant of childNodes(child)) {
			const found = findNodeInBlock(descendant, nodeId);
			if (found) return found;
		}
	}

	return null;
}

function findNodeInBlock(node: SequenceBlock, nodeId: string): SequenceBlock | null {
	if (node.id === nodeId) return node;

	for (const child of childNodes(node)) {
		const found = findNodeInBlock(child, nodeId);
		if (found) return found;
	}

	return null;
}

function transformNode(
	node: SequenceBlock,
	nodeId: string,
	transform: (node: SequenceBlock) => SequenceBlock
): SequenceBlock {
	if (node.id === nodeId) return transform(node);
	if (node.type !== 'sequence' && node.type !== 'parallel') return node;

	return {
		...node,
		children: node.children.map((child) => transformNode(child, nodeId, transform))
	};
}

export function updateBlock(
	document: SequenceDocument,
	nodeId: string,
	update: (node: SequenceBlock) => SequenceBlock
): SequenceDocument {
	if (!findNode(document.root, nodeId)) return document;

	return {
		...document,
		root: transformNode(document.root, nodeId, update) as SequenceNode
	};
}

function insertIntoRoot(root: SequenceNode, parentId: string, index: number, block: SequenceBlock) {
	let inserted = false;

	const nextRoot = transformNode(root, parentId, (node) => {
		if (node.type !== 'sequence' && node.type !== 'parallel') return node;

		inserted = true;
		const safeIndex = Math.max(0, Math.min(index, node.children.length));
		return {
			...node,
			children: [...node.children.slice(0, safeIndex), block, ...node.children.slice(safeIndex)]
		};
	}) as SequenceNode;

	return inserted ? nextRoot : root;
}

export function insertBlock(
	document: SequenceDocument,
	parentId: string,
	index: number,
	block: SequenceBlock
): SequenceDocument {
	if (findNode(document.root, block.id)) return document;

	const parent = findNode(document.root, parentId);
	if (parent?.type !== 'sequence' && parent?.type !== 'parallel') return document;

	const root = insertIntoRoot(document.root, parentId, index, block);
	return root === document.root ? document : { ...document, root };
}

type ParentLocation = {
	parentId: string;
	index: number;
};

function findParent(node: SequenceBlock, nodeId: string): ParentLocation | null {
	if (node.type !== 'sequence' && node.type !== 'parallel') return null;

	for (let index = 0; index < node.children.length; index += 1) {
		const child = node.children[index];
		if (child.id === nodeId) return { parentId: node.id, index };

		const found = findParent(child, nodeId);
		if (found) return found;
	}

	return null;
}

function containsNode(node: SequenceBlock, nodeId: string): boolean {
	if (node.id === nodeId) return true;
	return childNodes(node).some((child) => containsNode(child, nodeId));
}

function removeFromNode(
	node: SequenceBlock,
	nodeId: string
): { node: SequenceBlock; removed: SequenceBlock | null } {
	if (node.type !== 'sequence' && node.type !== 'parallel') {
		return { node, removed: null };
	}

	const directIndex = node.children.findIndex((child) => child.id === nodeId);
	if (directIndex >= 0) {
		return {
			node: {
				...node,
				children: node.children.filter((_, index) => index !== directIndex)
			},
			removed: node.children[directIndex]
		};
	}

	for (let index = 0; index < node.children.length; index += 1) {
		const result = removeFromNode(node.children[index], nodeId);
		if (!result.removed) continue;

		const children = [...node.children];
		children[index] = result.node;
		return { node: { ...node, children }, removed: result.removed };
	}

	return { node, removed: null };
}

export function removeBlock(document: SequenceDocument, nodeId: string): SequenceDocument {
	if (nodeId === document.root.id) return document;

	const result = removeFromNode(document.root, nodeId);
	return result.removed ? { ...document, root: result.node as SequenceNode } : document;
}

export function moveBlock(
	document: SequenceDocument,
	nodeId: string,
	parentId: string,
	index: number
): SequenceDocument {
	if (nodeId === document.root.id) return document;

	const movingNode = findNode(document.root, nodeId);
	const targetParent = findNode(document.root, parentId);
	const source = findParent(document.root, nodeId);

	if (
		!movingNode ||
		(targetParent?.type !== 'sequence' && targetParent?.type !== 'parallel') ||
		!source
	) {
		return document;
	}
	if (containsNode(movingNode, parentId)) return document;

	const removed = removeFromNode(document.root, nodeId);
	if (!removed.removed) return document;

	const adjustedIndex =
		source.parentId === parentId && source.index < index ? Math.max(0, index - 1) : index;
	const root = insertIntoRoot(
		removed.node as SequenceNode,
		parentId,
		adjustedIndex,
		removed.removed
	);

	return root === removed.node ? document : { ...document, root };
}

function asParallelBranch(block: SequenceBlock, index: number): SequenceBlock {
	if (block.type === 'sequence') return block;

	return {
		id: createId('sequence'),
		type: 'sequence',
		name: `Branch ${index + 1}`,
		children: [block]
	};
}

function insertParallelBranchIntoRoot(
	root: SequenceNode,
	parallelId: string,
	index: number,
	block: SequenceBlock
) {
	const parallel = findNode(root, parallelId);
	if (parallel?.type !== 'parallel') return root;

	return insertIntoRoot(root, parallelId, index, asParallelBranch(block, index));
}

export function insertParallelBranch(
	document: SequenceDocument,
	parallelId: string,
	index: number,
	block: SequenceBlock
): SequenceDocument {
	if (findNode(document.root, block.id)) return document;
	if (findNode(document.root, parallelId)?.type !== 'parallel') return document;

	const root = insertParallelBranchIntoRoot(document.root, parallelId, index, block);
	return root === document.root ? document : { ...document, root };
}

function appendToParallelBranchRoot(
	root: SequenceNode,
	parallelId: string,
	branchId: string,
	block: SequenceBlock
) {
	const parallel = findNode(root, parallelId);
	if (parallel?.type !== 'parallel') return root;

	const branchIndex = parallel.children.findIndex((child) => child.id === branchId);
	if (branchIndex < 0) return root;

	const branch = parallel.children[branchIndex];
	if (branch.type === 'sequence') {
		return insertIntoRoot(root, branch.id, branch.children.length, block);
	}

	return transformNode(root, parallelId, (node) => {
		if (node.type !== 'parallel') return node;
		const children = [...node.children];
		children[branchIndex] = {
			id: createId('sequence'),
			type: 'sequence',
			name: `Branch ${branchIndex + 1}`,
			children: [branch, block]
		};
		return { ...node, children };
	}) as SequenceNode;
}

export function appendBlockToParallelBranch(
	document: SequenceDocument,
	parallelId: string,
	branchId: string,
	block: SequenceBlock
): SequenceDocument {
	if (findNode(document.root, block.id)) return document;

	const root = appendToParallelBranchRoot(document.root, parallelId, branchId, block);
	return root === document.root ? document : { ...document, root };
}

export function moveBlockToParallelBranch(
	document: SequenceDocument,
	nodeId: string,
	parallelId: string,
	branchId: string
): SequenceDocument {
	if (nodeId === document.root.id || nodeId === branchId) return document;

	const movingNode = findNode(document.root, nodeId);
	const branch = findNode(document.root, branchId);
	const parallel = findNode(document.root, parallelId);
	if (!movingNode || !branch || parallel?.type !== 'parallel') return document;
	if (!parallel.children.some((child) => child.id === branchId)) return document;
	if (containsNode(movingNode, branchId)) return document;

	const removed = removeFromNode(document.root, nodeId);
	if (!removed.removed) return document;

	const root = appendToParallelBranchRoot(
		removed.node as SequenceNode,
		parallelId,
		branchId,
		removed.removed
	);
	return root === removed.node ? document : { ...document, root };
}

export function moveBlockToNewParallelBranch(
	document: SequenceDocument,
	nodeId: string,
	parallelId: string,
	index: number
): SequenceDocument {
	if (nodeId === document.root.id) return document;

	const movingNode = findNode(document.root, nodeId);
	const parallel = findNode(document.root, parallelId);
	const source = findParent(document.root, nodeId);
	if (!movingNode || parallel?.type !== 'parallel' || !source) return document;
	if (containsNode(movingNode, parallelId)) return document;

	const removed = removeFromNode(document.root, nodeId);
	if (!removed.removed) return document;

	const adjustedIndex =
		source.parentId === parallelId && source.index < index ? Math.max(0, index - 1) : index;
	const root = insertParallelBranchIntoRoot(
		removed.node as SequenceNode,
		parallelId,
		adjustedIndex,
		removed.removed
	);
	return root === removed.node ? document : { ...document, root };
}

function lifecycleDuration(node: SequenceBlock, baseDuration: number | null): number | null {
	if (node.type === 'pause' || baseDuration === null) return baseDuration;
	if (node.until || node.await) return null;

	const repeat = node.repeat ?? 1;
	const delay = node.delay ?? 0;
	return (baseDuration + delay) * repeat;
}

export function nodeDurationSeconds(node: SequenceBlock): number | null {
	if (node.type === 'pause') return null;
	if (node.type === 'action') {
		return lifecycleDuration(node, node.estimatedDurationSeconds ?? 0);
	}

	const childDurations = node.children.map(nodeDurationSeconds);
	if (childDurations.some((duration) => duration === null)) return null;

	const durations = childDurations as number[];
	const baseDuration =
		node.type === 'sequence'
			? durations.reduce((total, duration) => total + duration, 0)
			: Math.max(0, ...durations);

	return lifecycleDuration(node, baseDuration);
}

export function formatDuration(seconds: number | null) {
	if (seconds === null) return 'indeterminate';

	const rounded = Math.max(0, Math.round(seconds));
	const hours = Math.floor(rounded / 3600);
	const minutes = Math.floor((rounded % 3600) / 60);
	const remainder = rounded % 60;

	if (hours > 0) return `${hours}h ${minutes}m ${remainder}s`;
	if (minutes > 0) return `${minutes}m ${remainder}s`;
	return `${remainder}s`;
}

function accumulateSummary(node: SequenceBlock, depth: number, summary: SequenceSummary) {
	summary.maxDepth = Math.max(summary.maxDepth, depth);

	if (node.type === 'action') {
		summary.actions += 1;
		return;
	}

	if (node.type === 'pause') {
		summary.pauses += 1;
		return;
	}

	if (node.type === 'sequence') summary.sequences += 1;
	if (node.type === 'parallel') {
		summary.parallels += 1;
		summary.branches += node.children.length;
	}

	for (const child of node.children) accumulateSummary(child, depth + 1, summary);
}

export function summarizeSequence(root: SequenceNode): SequenceSummary {
	const summary: SequenceSummary = {
		actions: 0,
		sequences: 0,
		parallels: 0,
		pauses: 0,
		branches: 0,
		maxDepth: 0
	};

	accumulateSummary(root, 1, summary);
	return summary;
}

export function nodeLabel(node: SequenceBlock) {
	if (node.type === 'action') return node.label || humanizeIdentifier(node.action);
	return node.name;
}

export function nodeDescription(node: SequenceBlock) {
	if (node.type === 'action') return node.action;
	if (node.type === 'parallel') return `${node.children.length} simultaneous blocks`;
	if (node.type === 'pause') return node.reason || 'Pauses the shared sequence context';
	return `${node.children.length} ordered blocks`;
}

export function formatArgumentValue(value: YamlValue | undefined) {
	if (value === undefined) return '—';
	if (value === null) return 'null';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

export function primaryArgumentFor(
	node: ActionNode,
	actions: ActionDefinition[]
): { name: string; type?: string; value: YamlValue | undefined } | null {
	const definition = actions.find((action) => action.name === node.action);
	const primaryName =
		definition?.primary ?? definition?.args.find((argument) => argument.primary)?.name ?? null;
	if (!primaryName) return null;

	const argument = definition?.args.find((candidate) => candidate.name === primaryName);
	return {
		name: primaryName,
		type: argument?.type,
		value: node.args[primaryName]
	};
}

export function createAction(
	id: string,
	label: string,
	action: string,
	estimatedDurationSeconds: number,
	options: Pick<ActionNode, 'args' | 'device' | 'register'> = { args: {} }
): ActionNode {
	return {
		id,
		type: 'action',
		label,
		action,
		args: options.args,
		device: options.device,
		register: options.register,
		estimatedDurationSeconds
	};
}

export function createSequence(id: string, name: string, children: SequenceBlock[]): SequenceNode {
	return { id, type: 'sequence', name, children };
}

export function createParallel(id: string, name: string, children: SequenceBlock[]): ParallelNode {
	return { id, type: 'parallel', name, children };
}

export function createPause(id: string, name: string, reason?: string): PauseNode {
	return { id, type: 'pause', name, reason };
}
