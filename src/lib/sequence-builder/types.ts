export type ScalarValue = string | number | boolean | null;
export type YamlValue = ScalarValue | YamlValue[] | { [key: string]: YamlValue };
export type ExtraYamlFields = Record<string, YamlValue>;

export type Lifecycle = {
	delay?: number;
	repeat?: number;
	when?: string;
	await?: string;
	await_timeout?: number;
	until?: string;
	update?: boolean;
	extra?: ExtraYamlFields;
};

export type ActionArgumentDefinition = {
	name: string;
	type?: string;
	primary?: boolean;
	[key: string]: unknown;
};

export type ActionDefinition = {
	name: string;
	action_type: string;
	args: ActionArgumentDefinition[];
	primary: string | null;
	[key: string]: unknown;
};

export type ConditionArgumentDefinition = {
	name: string;
	required: boolean;
	type?: string;
	default?: YamlValue;
	[key: string]: unknown;
};

export type ConditionDefinition = {
	name: string;
	args: ConditionArgumentDefinition[];
	[key: string]: unknown;
};

export type ConfiguredDevice = {
	type: string;
	id: string;
	name: string | null;
};

export type ActionNode = Lifecycle & {
	id: string;
	type: 'action';
	action: string;
	label: string;
	device?: string;
	args: Record<string, YamlValue>;
	register?: string;
	estimatedDurationSeconds?: number;
};

export type SequenceNode = Lifecycle & {
	id: string;
	type: 'sequence';
	name: string;
	children: SequenceBlock[];
};

export type ParallelNode = Lifecycle & {
	id: string;
	type: 'parallel';
	name: string;
	children: SequenceBlock[];
};

export type PauseNode = {
	id: string;
	type: 'pause';
	name: string;
	reason?: string;
	extra?: ExtraYamlFields;
};

export type SequenceBlock = ActionNode | SequenceNode | ParallelNode | PauseNode;

export type SequenceDocument = {
	id: string;
	name: string;
	description?: string;
	root: SequenceNode;
	version: number;
	extra?: ExtraYamlFields;
};

export type ValidationIssue = {
	id: string;
	nodeId: string;
	severity: 'error' | 'warning';
	message: string;
};

export type SequenceSummary = {
	actions: number;
	sequences: number;
	parallels: number;
	pauses: number;
	branches: number;
	maxDepth: number;
};

export type LibraryBlockType = 'action' | 'sequence' | 'parallel' | 'pause';

export type DragSourceData =
	| { kind: 'library-block'; blockType: LibraryBlockType; actionName?: string }
	| { kind: 'existing-block'; nodeId: string };

export type DropTargetData =
	| {
			kind: 'container-slot';
			parentId: string;
			index: number;
	  }
	| {
			kind: 'parallel-branch';
			parallelId: string;
			branchId: string;
	  }
	| {
			kind: 'parallel-new-branch';
			parallelId: string;
			index: number;
	  };
