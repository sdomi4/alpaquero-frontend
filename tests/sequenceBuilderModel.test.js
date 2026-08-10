import assert from 'node:assert/strict';
import test from 'node:test';

import {
	appendBlockToParallelBranch,
	createAction,
	createParallel,
	createPause,
	createSequence,
	formatDuration,
	insertBlock,
	insertParallelBranch,
	moveBlock,
	moveBlockToNewParallelBranch,
	moveBlockToParallelBranch,
	nodeDurationSeconds,
	primaryArgumentFor,
	summarizeSequence,
	validateSequence
} from '../src/lib/sequence-builder/model.ts';

function createDocument() {
	const branchA = createSequence('branch-a', 'Branch A', [
		createAction('action-a', 'Action A', 'action_a', 20)
	]);
	const branchB = createSequence('branch-b', 'Branch B', [
		createAction('action-b', 'Action B', 'action_b', 45)
	]);

	return {
		id: 'document',
		name: 'Test sequence',
		version: 1,
		root: createSequence('root', 'Root', [
			createAction('before', 'Before', 'before', 10),
			createParallel('parallel', 'Parallel', [branchA, branchB]),
			createAction('after', 'After', 'after', 5)
		])
	};
}

test('parallel duration uses the longest branch while ordered children are summed', () => {
	const document = createDocument();

	assert.equal(nodeDurationSeconds(document.root), 60);
	assert.equal(formatDuration(nodeDurationSeconds(document.root)), '1m 0s');
});

test('summary counts actions, sequences, parallel blocks, branches, and depth', () => {
	const summary = summarizeSequence(createDocument().root);

	assert.deepEqual(summary, {
		actions: 4,
		sequences: 3,
		parallels: 1,
		pauses: 0,
		branches: 2,
		maxDepth: 4
	});
});

test('blocks can move between explicit parallel branch sequences', () => {
	const document = createDocument();
	const moved = moveBlock(document, 'before', 'branch-a', 1);

	assert.deepEqual(
		moved.root.children.map((node) => node.id),
		['parallel', 'after']
	);

	const parallel = moved.root.children[0];
	assert.equal(parallel.type, 'parallel');
	const branch = parallel.type === 'parallel' ? parallel.children[0] : null;
	assert.equal(branch?.type, 'sequence');
	assert.deepEqual(branch?.type === 'sequence' ? branch.children.map((node) => node.id) : [], [
		'action-a',
		'before'
	]);
});

test('dropping onto a parallel branch appends to the branch sequence', () => {
	const document = createDocument();
	const action = createAction('action-c', 'Action C', 'action_c', 5);
	const updated = appendBlockToParallelBranch(document, 'parallel', 'branch-a', action);

	const parallel = updated.root.children.find((node) => node.id === 'parallel');
	assert.equal(parallel?.type, 'parallel');
	const branch = parallel?.type === 'parallel' ? parallel.children[0] : null;
	assert.equal(branch?.type, 'sequence');
	assert.deepEqual(branch?.type === 'sequence' ? branch.children.map((node) => node.id) : [], [
		'action-a',
		'action-c'
	]);
});

test('dropping onto a direct action branch promotes it to an ordered sequence', () => {
	const directAction = createAction('direct-action', 'Direct action', 'direct_action', 1);
	const document = {
		id: 'direct-branch-document',
		name: 'Direct branch',
		version: 1,
		root: createSequence('root', 'Root', [createParallel('parallel', 'Parallel', [directAction])])
	};
	const appended = createAction('appended-action', 'Appended action', 'appended_action', 1);
	const updated = appendBlockToParallelBranch(document, 'parallel', 'direct-action', appended);

	const parallel = updated.root.children[0];
	assert.equal(parallel.type, 'parallel');
	const branch = parallel.type === 'parallel' ? parallel.children[0] : null;
	assert.equal(branch?.type, 'sequence');
	assert.deepEqual(branch?.type === 'sequence' ? branch.children.map((node) => node.id) : [], [
		'direct-action',
		'appended-action'
	]);
});

test('dropping to the right of a parallel group creates a direct branch', () => {
	const document = createDocument();
	const action = createAction('action-c', 'Action C', 'action_c', 5);
	const updated = insertParallelBranch(document, 'parallel', 2, action);

	const parallel = updated.root.children.find((node) => node.id === 'parallel');
	assert.equal(parallel?.type, 'parallel');
	assert.equal(parallel?.type === 'parallel' ? parallel.children.length : 0, 3);
	const branch = parallel?.type === 'parallel' ? parallel.children[2] : null;
	assert.equal(branch?.type, 'action');
	assert.equal(branch?.id, 'action-c');
});

test('existing blocks can append to a branch or become a new parallel branch', () => {
	const document = createDocument();
	const appended = moveBlockToParallelBranch(document, 'before', 'parallel', 'branch-b');
	const appendedParallel = appended.root.children[0];
	assert.equal(appendedParallel.type, 'parallel');
	const branchB =
		appendedParallel.type === 'parallel'
			? appendedParallel.children.find((node) => node.id === 'branch-b')
			: null;
	assert.deepEqual(branchB?.type === 'sequence' ? branchB.children.map((node) => node.id) : [], [
		'action-b',
		'before'
	]);

	const branched = moveBlockToNewParallelBranch(appended, 'after', 'parallel', 2);
	const branchedParallel = branched.root.children[0];
	assert.equal(branchedParallel.type, 'parallel');
	const newBranch = branchedParallel.type === 'parallel' ? branchedParallel.children[2] : null;
	assert.equal(newBranch?.type, 'action');
	assert.equal(newBranch?.id, 'after');
});

test('moving a container into its own descendant is rejected without mutation', () => {
	const document = {
		id: 'nested-document',
		name: 'Nested',
		version: 1,
		root: createSequence('root', 'Root', [
			createSequence('nested', 'Nested', [createSequence('descendant', 'Descendant', [])])
		])
	};

	assert.equal(moveBlock(document, 'nested', 'descendant', 0), document);
});

test('validation does not impose a nesting depth recommendation', () => {
	const action = createAction('deep-action', 'Deep action', 'deep_action', 0);
	const levelFive = createSequence('level-five', 'Level five', [action]);
	const levelFour = createSequence('level-four', 'Level four', [levelFive]);
	const levelThree = createSequence('level-three', 'Level three', [levelFour]);
	const levelTwo = createSequence('level-two', 'Level two', [levelThree]);
	const document = {
		id: 'deep-document',
		name: 'Deep document',
		version: 1,
		root: createSequence('root', 'Root', [levelTwo])
	};

	assert.equal(
		validateSequence(document).some(
			(issue) => issue.id.endsWith(':depth') || issue.message.toLowerCase().includes('nesting')
		),
		false
	);
});

test('invalid insertion targets do not mutate the document', () => {
	const document = createDocument();
	const block = createAction('new-action', 'New', 'new_action', 1);

	assert.equal(insertBlock(document, 'before', 0, block), document);
});

test('validation reports empty sequences against stable node ids', () => {
	const document = {
		id: 'empty-document',
		name: 'Empty',
		version: 1,
		root: createSequence('empty-root', 'Empty root', [])
	};

	assert.deepEqual(validateSequence(document), [
		{
			id: 'empty-root:empty',
			nodeId: 'empty-root',
			severity: 'warning',
			message: 'Sequence contains no blocks.'
		}
	]);
});

test('primary action argument metadata resolves to the current block value', () => {
	const action = createAction('exposure', 'Expose Camera', 'expose_camera', 5, {
		device: 'sim_camera',
		args: { exposure: 12.5 }
	});
	const definitions = [
		{
			name: 'expose_camera',
			action_type: 'device',
			args: [
				{ name: 'exposure', type: 'float', primary: true },
				{ name: 'binX', type: 'int' }
			],
			primary: 'exposure'
		}
	];

	assert.deepEqual(primaryArgumentFor(action, definitions), {
		name: 'exposure',
		type: 'float',
		value: 12.5
	});
});

test('registry validation accepts friendly names, requires devices, and warns about unknown args', () => {
	const action = createAction('exposure', 'Custom exposure', 'expose_camera', 5, {
		args: { exposure: 5, mystery: true }
	});
	const document = {
		id: 'registry-document',
		name: 'Registry',
		version: 1,
		root: createSequence('root', 'Root', [action])
	};
	const definitions = [
		{
			name: 'expose_camera',
			action_type: 'device',
			args: [{ name: 'exposure', type: 'float', primary: true }],
			primary: 'exposure'
		}
	];

	assert.deepEqual(
		validateSequence(document, definitions, []).map((issue) => [
			issue.severity,
			issue.nodeId,
			issue.message
		]),
		[
			['error', 'exposure', 'Device actions require a configured device ID.'],
			['warning', 'exposure', 'Argument "mystery" is not exposed by the action registry.']
		]
	);
});

test('validation accepts sequential result templates and rejects forward references', () => {
	const producer = createAction('producer', 'Debug Timestamp', 'debug_timestamp', 0, {
		args: {},
		register: 'capture'
	});
	const consumer = createAction('consumer', 'Debug Print', 'debug_print', 0, {
		args: { message: 'Saved: {{ capture.result }}' }
	});
	const actions = [
		{ name: 'debug_timestamp', action_type: 'debug', args: [], primary: null },
		{
			name: 'debug_print',
			action_type: 'debug',
			args: [{ name: 'message', type: 'str' }],
			primary: null
		}
	];
	const safeDocument = {
		id: 'safe-template',
		name: 'Safe template',
		version: 1,
		root: createSequence('safe-root', 'Safe template', [producer, consumer])
	};
	const unsafeDocument = {
		...safeDocument,
		id: 'unsafe-template',
		root: createSequence('unsafe-root', 'Unsafe template', [consumer, producer])
	};

	assert.equal(
		validateSequence(safeDocument, actions).some((issue) =>
			issue.message.includes('before it can be registered')
		),
		false
	);
	assert.equal(
		validateSequence(unsafeDocument, actions).some(
			(issue) => issue.severity === 'error' && issue.message.includes('before it can be registered')
		),
		true
	);
});

test('validation warns about cross-branch result dependencies', () => {
	const producer = createAction('producer', 'Debug Timestamp', 'debug_timestamp', 0, {
		args: {},
		register: 'capture'
	});
	const consumer = createAction('consumer', 'Debug Print', 'debug_print', 0, {
		args: { message: '{{ capture.result }}' }
	});
	const document = {
		id: 'parallel-template',
		name: 'Parallel template',
		version: 1,
		root: createSequence('root', 'Parallel template', [
			createParallel('parallel', 'Parallel', [producer, consumer])
		])
	};
	const actions = [
		{ name: 'debug_timestamp', action_type: 'debug', args: [], primary: null },
		{
			name: 'debug_print',
			action_type: 'debug',
			args: [{ name: 'message', type: 'str' }],
			primary: null
		}
	];

	assert.equal(
		validateSequence(document, actions).some(
			(issue) => issue.severity === 'warning' && issue.message.includes('another parallel branch')
		),
		true
	);
});

test('validation enforces reserved registrations and condition metadata', () => {
	const action = createAction('registered', 'Debug Timestamp', 'debug_timestamp', 0, {
		args: {},
		register: 'args'
	});
	const root = createSequence('root', 'Conditions', [action]);
	root.await = '{{ conditions.not_registered() }}';
	root.await_timeout = 10;
	const document = {
		id: 'condition-document',
		name: 'Conditions',
		version: 1,
		root
	};
	const conditions = [{ name: 'weather_is_safe', args: [] }];
	const issues = validateSequence(
		document,
		[{ name: 'debug_timestamp', action_type: 'debug', args: [], primary: null }],
		[],
		conditions
	);

	assert.equal(
		issues.some((issue) => issue.message.includes('"args" is reserved')),
		true
	);
	assert.equal(
		issues.some((issue) => issue.message.includes('unknown condition')),
		true
	);
});

test('validation accepts clock times for until without a wrapped condition expression', () => {
	for (const until of ['05:30', '23:59:59']) {
		const root = createSequence('root', 'Timed sequence', [
			createAction('action', 'Timed action', 'timed_action', 0)
		]);
		root.until = until;
		const document = {
			id: `timed-until-${until}`,
			name: 'Timed until',
			version: 1,
			root
		};

		assert.equal(
			validateSequence(document).some(
				(issue) => issue.nodeId === root.id && issue.severity === 'error'
			),
			false
		);
	}
});

test('validation rejects lifecycle fields preserved on pause nodes', () => {
	const pause = createPause('pause', 'Operator pause');
	pause.extra = { await: '{{ args.ready }}' };
	const document = {
		id: 'pause-lifecycle',
		name: 'Pause lifecycle',
		version: 1,
		root: createSequence('root', 'Pause lifecycle', [pause])
	};

	assert.equal(
		validateSequence(document).some(
			(issue) => issue.severity === 'error' && issue.message.includes('Pause nodes cannot use')
		),
		true
	);
});
