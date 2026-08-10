import type {
	ActionDefinition,
	ConditionDefinition,
	ConfiguredDevice,
	SequenceBlock,
	SequenceDocument,
	SequenceNode,
	ValidationIssue,
	YamlValue
} from './types';

const CLOCK_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const CONDITION_PATTERN = /^\{\{\s*(.+?)\s*\}\}$/s;
const TEMPLATE_PATTERN = /\{\{\s*(.+?)\s*\}\}/gs;
const TEMPLATE_PATH_PATTERN =
	/^[A-Za-z_][A-Za-z0-9_]*(?:(?:\.[A-Za-z_][A-Za-z0-9_]*)|(?:\[(?:\d+|'[^']*'|"[^"]*"|[A-Za-z_][A-Za-z0-9_]*)\]))*$/;
const REGISTER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED_REGISTRATIONS = new Set(['args', 'observatory', 'conditions']);
const PAUSE_LIFECYCLE_FIELDS = new Set([
	'delay',
	'repeat',
	'when',
	'await',
	'await_timeout',
	'until',
	'update'
]);

const EXPECTED_DEVICE_TYPES: Record<string, string> = {
	cool_camera: 'camera',
	wait_for_camera_temperature: 'camera',
	warm_camera: 'camera',
	expose_camera: 'camera',
	create_fits: 'camera',
	expose_and_save_camera: 'camera',
	open_cover: 'cover',
	close_cover: 'cover',
	enable_calibrator: 'cover',
	disable_calibrator: 'cover',
	open_dome: 'dome',
	close_dome: 'dome',
	move_filterwheel: 'filterwheel',
	set_switch: 'switch',
	park_telescope: 'telescope',
	unpark_telescope: 'telescope',
	slew_telescope: 'telescope'
};

function humanizeIdentifier(value: string) {
	return value
		.replaceAll('_', ' ')
		.replace(/\b\w/g, (character) => character.toUpperCase())
		.trim();
}

function childNodes(node: SequenceBlock) {
	return node.type === 'sequence' || node.type === 'parallel' ? node.children : [];
}

function pushIssue(
	issues: ValidationIssue[],
	node: SequenceBlock,
	key: string,
	severity: ValidationIssue['severity'],
	message: string
) {
	issues.push({ id: `${node.id}:${key}`, nodeId: node.id, severity, message });
}

function registrationNames(node: SequenceBlock): Set<string> {
	const names = new Set<string>();
	if (node.type === 'action' && node.register) names.add(node.register);
	for (const child of childNodes(node)) {
		for (const name of registrationNames(child)) names.add(name);
	}
	return names;
}

function templateRoot(expression: string) {
	return expression.match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0] ?? null;
}

function validateTemplateString(
	value: string,
	path: string,
	node: SequenceBlock,
	available: Set<string>,
	parallelRegistrations: Set<string>,
	issues: ValidationIssue[]
) {
	const matches = [...value.matchAll(TEMPLATE_PATTERN)];
	const remainder = value.replace(TEMPLATE_PATTERN, '');
	if (remainder.includes('{{') || remainder.includes('}}')) {
		pushIssue(
			issues,
			node,
			`template:${path}:braces`,
			'error',
			`${path} contains an incomplete template expression.`
		);
		return;
	}

	for (const [index, match] of matches.entries()) {
		const expression = match[1].trim();
		if (!TEMPLATE_PATH_PATTERN.test(expression)) {
			pushIssue(
				issues,
				node,
				`template:${path}:${index}`,
				'error',
				`${path} uses unsupported template syntax. Templates may only contain path lookups.`
			);
			continue;
		}

		const root = templateRoot(expression);
		if (!root || root === 'args') continue;
		if (root === 'observatory' || root === 'conditions') {
			pushIssue(
				issues,
				node,
				`template:${path}:${index}:root`,
				'error',
				`${path} cannot use "${root}" in an action template.`
			);
		} else if (available.has(root)) {
			continue;
		} else if (parallelRegistrations.has(root)) {
			pushIssue(
				issues,
				node,
				`template:${path}:${index}:parallel`,
				'warning',
				`${path} consumes "${root}" from another parallel branch before ordering is guaranteed.`
			);
		} else {
			pushIssue(
				issues,
				node,
				`template:${path}:${index}:registration`,
				'error',
				`${path} references "${root}" before it can be registered on this sequential path.`
			);
		}
	}
}

function validateTemplateValue(
	value: YamlValue,
	path: string,
	node: SequenceBlock,
	available: Set<string>,
	parallelRegistrations: Set<string>,
	issues: ValidationIssue[]
) {
	if (typeof value === 'string') {
		validateTemplateString(value, path, node, available, parallelRegistrations, issues);
	} else if (Array.isArray(value)) {
		value.forEach((item, index) =>
			validateTemplateValue(
				item,
				`${path}[${index}]`,
				node,
				available,
				parallelRegistrations,
				issues
			)
		);
	} else if (value && typeof value === 'object') {
		for (const [key, item] of Object.entries(value)) {
			validateTemplateValue(item, `${path}.${key}`, node, available, parallelRegistrations, issues);
		}
	}
}

function validateConditionExpression(
	value: string,
	field: string,
	node: SequenceBlock,
	available: Set<string>,
	parallelRegistrations: Set<string>,
	conditions: ConditionDefinition[],
	issues: ValidationIssue[]
) {
	const match = value.match(CONDITION_PATTERN);
	if (!match) {
		pushIssue(
			issues,
			node,
			field,
			'error',
			`${field} must contain exactly one {{ condition expression }}.`
		);
		return;
	}

	const expression = match[1].trim();
	const stringless = expression.replace(/'(?:\\.|[^'])*'|"(?:\\.|[^"])*"/g, '');
	if (
		!expression ||
		/[{};|$+*/%]/.test(stringless) ||
		/__[A-Za-z0-9_]*/.test(stringless) ||
		!/^[A-Za-z0-9_.'"\[\](),:=<>\s!-]+$/.test(expression)
	) {
		pushIssue(
			issues,
			node,
			field,
			'error',
			`${field} contains syntax outside the supported condition language.`
		);
		return;
	}

	const knownConditions = new Set(conditions.map((condition) => condition.name));
	for (const call of stringless.matchAll(/([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g)) {
		const callable = call[1];
		if (!callable.startsWith('conditions.')) {
			pushIssue(
				issues,
				node,
				`${field}:call:${call.index}`,
				'error',
				`${field} may only call discovered conditions.`
			);
		} else {
			const conditionName = callable.slice('conditions.'.length);
			if (conditions.length > 0 && !knownConditions.has(conditionName)) {
				pushIssue(
					issues,
					node,
					`${field}:condition:${conditionName}`,
					'error',
					`${field} references unknown condition "${conditionName}".`
				);
			}
		}
	}

	const ignored = new Set([
		'and',
		'or',
		'not',
		'in',
		'True',
		'False',
		'None',
		'true',
		'false',
		'null'
	]);
	for (const token of stringless.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
		const name = token[0];
		const index = token.index ?? 0;
		const before = stringless.slice(0, index).trimEnd().at(-1);
		const after = stringless.slice(index + name.length).trimStart();
		if (before === '.' || after.startsWith('=') || ignored.has(name)) continue;
		if (name === 'args' || name === 'observatory' || name === 'conditions') continue;
		if (available.has(name)) continue;
		if (parallelRegistrations.has(name)) {
			pushIssue(
				issues,
				node,
				`${field}:parallel:${name}`,
				'warning',
				`${field} depends on "${name}" from another parallel branch.`
			);
		} else {
			pushIssue(
				issues,
				node,
				`${field}:registration:${name}`,
				'error',
				`${field} references "${name}" before it can be registered on this sequential path.`
			);
		}
	}
}

function validateLifecycle(
	node: SequenceBlock,
	available: Set<string>,
	parallelRegistrations: Set<string>,
	conditions: ConditionDefinition[],
	issues: ValidationIssue[]
) {
	if (node.type === 'pause') return;

	if (node.repeat !== undefined && (!Number.isInteger(node.repeat) || node.repeat < 1)) {
		pushIssue(
			issues,
			node,
			'repeat',
			'error',
			'Repeat must be an integer greater than or equal to 1.'
		);
	}
	if (node.delay !== undefined && (!Number.isFinite(node.delay) || node.delay < 0)) {
		pushIssue(
			issues,
			node,
			'delay',
			'error',
			'Delay must be a finite number greater than or equal to 0.'
		);
	} else if (node.delay !== undefined && !Number.isInteger(node.delay)) {
		pushIssue(
			issues,
			node,
			'delay:fractional',
			'warning',
			'Fractional delays are truncated to whole seconds by the current engine.'
		);
	}

	if (node.when !== undefined) {
		validateConditionExpression(
			node.when,
			'when',
			node,
			available,
			parallelRegistrations,
			conditions,
			issues
		);
	}
	if (node.await !== undefined) {
		validateConditionExpression(
			node.await,
			'await',
			node,
			available,
			parallelRegistrations,
			conditions,
			issues
		);
	}
	if (
		node.await_timeout !== undefined &&
		(!Number.isFinite(node.await_timeout) || node.await_timeout < 0)
	) {
		pushIssue(
			issues,
			node,
			'await_timeout',
			'error',
			'Await timeout must be a finite number greater than or equal to 0.'
		);
	}
	if (node.await_timeout !== undefined && node.await === undefined) {
		pushIssue(
			issues,
			node,
			'await_timeout:without-await',
			'error',
			'Await timeout can only be set when an await condition is present.'
		);
	}

	if (node.until !== undefined) {
		if (!CLOCK_TIME_PATTERN.test(node.until)) {
			if (CONDITION_PATTERN.test(node.until)) {
				validateConditionExpression(
					node.until,
					'until',
					node,
					available,
					parallelRegistrations,
					conditions,
					issues
				);
			} else {
				pushIssue(
					issues,
					node,
					'until',
					'error',
					'Until must be a 24-hour time or a {{ condition expression }}.'
				);
			}
		}
	}

	if (node.update !== undefined && typeof node.update !== 'boolean') {
		pushIssue(issues, node, 'update', 'error', 'Update must be a boolean.');
	}
	if (node.repeat !== undefined && node.until !== undefined) {
		pushIssue(
			issues,
			node,
			'repeat-until',
			'warning',
			'Repeat forms a batch; the until condition is checked only between batches.'
		);
	}
}

function validateNode(
	node: SequenceBlock,
	issues: ValidationIssue[],
	actions: ActionDefinition[],
	devices: ConfiguredDevice[],
	conditions: ConditionDefinition[],
	available: Set<string>,
	parallelRegistrations: Set<string>
) {
	validateLifecycle(node, available, parallelRegistrations, conditions, issues);

	for (const key of Object.keys(node.extra ?? {})) {
		const pauseLifecycleField = node.type === 'pause' && PAUSE_LIFECYCLE_FIELDS.has(key);
		pushIssue(
			issues,
			node,
			`extra:${key}`,
			pauseLifecycleField ? 'error' : 'warning',
			pauseLifecycleField
				? `Pause nodes cannot use the lifecycle field "${key}".`
				: `Unknown YAML field "${key}" is preserved but not editable.`
		);
	}

	if (node.type === 'pause') {
		if (!node.name.trim())
			pushIssue(issues, node, 'pause-name', 'error', 'Pause name is required.');
		return;
	}

	if (node.type === 'action') {
		const definition = actions.find((action) => action.name === node.action);
		if (!node.action.trim() || (actions.length > 0 && !definition)) {
			pushIssue(
				issues,
				node,
				'action-name',
				'error',
				'Choose an action from the live action registry.'
			);
		}
		if (definition?.action_type === 'device' && !node.device) {
			pushIssue(issues, node, 'device', 'error', 'Device actions require a configured device ID.');
		}

		const deviceUsesTemplate = node.device?.includes('{{') ?? false;
		if (
			node.device &&
			!deviceUsesTemplate &&
			devices.length > 0 &&
			!devices.some((device) => device.id === node.device)
		) {
			pushIssue(
				issues,
				node,
				'device-unknown',
				'error',
				'The selected device is not currently configured.'
			);
		}
		if (node.device) {
			validateTemplateString(node.device, 'device', node, available, parallelRegistrations, issues);
		}

		const expectedDeviceType = EXPECTED_DEVICE_TYPES[node.action];
		const selectedDevice = devices.find((device) => device.id === node.device);
		if (expectedDeviceType && selectedDevice && selectedDevice.type !== expectedDeviceType) {
			pushIssue(
				issues,
				node,
				'device-type',
				'warning',
				`${humanizeIdentifier(node.action)} normally expects a ${expectedDeviceType} device.`
			);
		}

		if (definition) {
			const knownArgs = new Set(definition.args.map((argument) => argument.name));
			for (const name of Object.keys(node.args)) {
				if (!knownArgs.has(name)) {
					pushIssue(
						issues,
						node,
						`arg:${name}`,
						'warning',
						`Argument "${name}" is not exposed by the action registry.`
					);
				}
			}
		}
		for (const [name, value] of Object.entries(node.args)) {
			validateTemplateValue(value, `args.${name}`, node, available, parallelRegistrations, issues);
		}

		if (node.register) {
			if (!REGISTER_PATTERN.test(node.register)) {
				pushIssue(issues, node, 'register', 'error', 'Register must be a valid identifier.');
			} else if (RESERVED_REGISTRATIONS.has(node.register)) {
				pushIssue(
					issues,
					node,
					'register:reserved',
					'error',
					`"${node.register}" is reserved and cannot be used as a registration name.`
				);
			}
		}
		return;
	}

	if (node.children.length === 0) {
		pushIssue(
			issues,
			node,
			'empty',
			'warning',
			`${node.type === 'parallel' ? 'Parallel group' : 'Sequence'} contains no blocks.`
		);
	}

	if (node.type === 'sequence') {
		const sequentialRegistrations = new Set(available);
		for (const child of node.children) {
			validateNode(
				child,
				issues,
				actions,
				devices,
				conditions,
				sequentialRegistrations,
				parallelRegistrations
			);
			for (const name of registrationNames(child)) sequentialRegistrations.add(name);
		}
		return;
	}

	const producedByBranch = node.children.map(registrationNames);
	for (const [index, child] of node.children.entries()) {
		const siblingRegistrations = new Set(parallelRegistrations);
		producedByBranch.forEach((names, branchIndex) => {
			if (branchIndex !== index) {
				for (const name of names) siblingRegistrations.add(name);
			}
		});
		validateNode(
			child,
			issues,
			actions,
			devices,
			conditions,
			new Set(available),
			siblingRegistrations
		);
	}
}

function validateDuplicateRegistrations(root: SequenceNode, issues: ValidationIssue[]) {
	const firstOwner = new Map<string, string>();
	const walk = (node: SequenceBlock) => {
		if (node.type === 'action' && node.register) {
			if (firstOwner.has(node.register)) {
				pushIssue(
					issues,
					node,
					`register:duplicate:${node.register}`,
					'warning',
					`Registration "${node.register}" is reused and will overwrite an earlier result.`
				);
			} else {
				firstOwner.set(node.register, node.id);
			}
		}
		for (const child of childNodes(node)) walk(child);
	};
	walk(root);
}

export function validateSequence(
	document: SequenceDocument,
	actions: ActionDefinition[] = [],
	devices: ConfiguredDevice[] = [],
	conditions: ConditionDefinition[] = []
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	if (!document.name.trim()) {
		pushIssue(issues, document.root, 'document-name', 'error', 'Document name is required.');
	}
	for (const key of Object.keys(document.extra ?? {})) {
		pushIssue(
			issues,
			document.root,
			`extra:${key}`,
			'warning',
			`Unknown top-level YAML field "${key}" is preserved but not editable.`
		);
	}

	validateNode(document.root, issues, actions, devices, conditions, new Set(), new Set());
	validateDuplicateRegistrations(document.root, issues);
	return issues;
}
