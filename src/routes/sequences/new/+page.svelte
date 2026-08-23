<script lang="ts">
	import { onMount, type ComponentProps } from 'svelte';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { Feedback, defaultPreset } from '@dnd-kit/dom';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import logo from '$lib/assets/Arriero_Logo_Mono_Clear.svg';
	import {
		getSequenceYaml,
		listSequences,
		refreshSequenceCatalog,
		uploadSequenceYaml
	} from '$lib/api/observatory';
	import BlockNode from '$lib/components/sequence-builder/BlockNode.svelte';
	import BuilderLibraryItem from '$lib/components/sequence-builder/BuilderLibraryItem.svelte';
	import {
		appendBlockToParallelBranch,
		createBlock,
		createSequence,
		findNode,
		humanizeIdentifier,
		insertBlock,
		insertParallelBranch,
		moveBlock,
		moveBlockToNewParallelBranch,
		moveBlockToParallelBranch,
		nodeLabel,
		pasteBlock,
		removeBlock,
		updateBlock,
		validateSequence
	} from '$lib/sequence-builder/model';
	import type {
		DragSourceData,
		DropTargetData,
		LibraryBlockType,
		SequenceBlock,
		SequenceDocument,
		YamlValue
	} from '$lib/sequence-builder/types';
	import {
		parseSequenceYaml,
		sequenceYamlFilename,
		serializeSequenceYaml
	} from '$lib/sequence-builder/yaml';

	let { data }: { data: PageData } = $props();

	function createNewSequenceDocument(): SequenceDocument {
		return {
			id: 'new-sequence',
			name: 'New Sequence',
			version: 1,
			root: createSequence('root-sequence', 'New Sequence', [])
		};
	}

	let document = $state<SequenceDocument>(createNewSequenceDocument());
	let selectedId = $state<string | null>('root-sequence');
	let history = $state<SequenceDocument[]>([]);
	let future = $state<SequenceDocument[]>([]);
	let librarySearch = $state('');
	let savedSequenceNames = $state<string[]>([]);
	let refreshedSequenceNames = $state<string[] | null>(null);
	let loadedCatalogName = $state<string | null>(null);
	let pendingCatalogName = $state<string | null>(null);
	let pendingNewSequence = $state(false);
	let isDirty = $state(false);
	let isLoading = $state(false);
	let isSaving = $state(false);
	let operationMessage = $state<string | null>(null);
	let operationError = $state<string | null>(null);
	let deviceInput = $state<HTMLInputElement | null>(null);
	let copiedNode = $state<SequenceBlock | null>(null);
	const dragDropPlugins = defaultPreset.plugins.map((plugin) =>
		plugin === Feedback ? Feedback.configure({ dropAnimation: null }) : plugin
	);

	const actions = $derived(data.actions ?? []);
	const conditions = $derived(data.conditions ?? []);
	const devices = $derived(data.devices ?? []);
	const catalogSequences = $derived(
		Array.from(
			new Set([...(refreshedSequenceNames ?? data.sequences ?? []), ...savedSequenceNames])
		).sort((a, b) => a.localeCompare(b))
	);
	const selectedNode = $derived(selectedId ? findNode(document.root, selectedId) : null);
	const selectedActionDefinition = $derived(
		selectedNode?.type === 'action'
			? (actions.find((action) => action.name === selectedNode.action) ?? null)
			: null
	);
	const issues = $derived(validateSequence(document, actions, devices, conditions));
	const selectedNodeIssues = $derived(
		selectedNode ? issues.filter((issue) => issue.nodeId === selectedNode.id) : []
	);
	const errorCount = $derived(issues.filter((issue) => issue.severity === 'error').length);

	const structuralItems: Array<{
		blockType: Exclude<LibraryBlockType, 'action'>;
		label: string;
		description: string;
		icon: string;
	}> = [
		{
			blockType: 'sequence',
			label: 'Sequence',
			description: 'Runs child blocks in order',
			icon: '▤'
		},
		{
			blockType: 'parallel',
			label: 'Parallel',
			description: 'Runs direct children concurrently',
			icon: '⑂'
		},
		{
			blockType: 'pause',
			label: 'Pause',
			description: 'Waits for an external resume',
			icon: 'Ⅱ'
		}
	];

	const normalizedSearch = $derived(librarySearch.trim().toLowerCase());
	const visibleStructuralItems = $derived(
		structuralItems.filter((item) =>
			`${item.label} ${item.description}`.toLowerCase().includes(normalizedSearch)
		)
	);
	const visibleActions = $derived(
		actions.filter((action) =>
			`${action.name} ${action.action_type} ${action.args.map((argument) => argument.name).join(' ')}`
				.toLowerCase()
				.includes(normalizedSearch)
		)
	);

	function conditionExample(name: string) {
		return `{{ conditions.${name}() }}`;
	}

	function applyDocument(next: SequenceDocument, nextSelection = selectedId) {
		if (next === document) return;
		history = [...history, document];
		document = next;
		future = [];
		selectedId = nextSelection;
		isDirty = true;
		operationMessage = null;
		operationError = null;
	}

	function undo() {
		const previous = history.at(-1);
		if (!previous) return;

		history = history.slice(0, -1);
		future = [document, ...future];
		document = previous;
		isDirty = true;
		if (selectedId && !findNode(document.root, selectedId)) selectedId = document.root.id;
	}

	function redo() {
		const next = future[0];
		if (!next) return;

		history = [...history, document];
		future = future.slice(1);
		document = next;
		isDirty = true;
		if (selectedId && !findNode(document.root, selectedId)) selectedId = document.root.id;
	}

	function blockFromSource(source: Extract<DragSourceData, { kind: 'library-block' }>) {
		const definition = source.actionName
			? actions.find((action) => action.name === source.actionName)
			: undefined;
		return createBlock(source.blockType, definition);
	}

	type DragEndHandler = NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>;

	const handleDragEnd: DragEndHandler = (event) => {
		if (event.canceled) return;

		const source = event.operation.source?.data as DragSourceData | undefined;
		const target = event.operation.target?.data as DropTargetData | undefined;
		if (!source || !target) return;

		if (source.kind === 'library-block') {
			const block = blockFromSource(source);
			const next =
				target.kind === 'container-slot'
					? insertBlock(document, target.parentId, target.index, block)
					: target.kind === 'parallel-branch'
						? appendBlockToParallelBranch(document, target.parallelId, target.branchId, block)
						: insertParallelBranch(document, target.parallelId, target.index, block);
			applyDocument(next, block.id);
			return;
		}

		const next =
			target.kind === 'container-slot'
				? moveBlock(document, source.nodeId, target.parentId, target.index)
				: target.kind === 'parallel-branch'
					? moveBlockToParallelBranch(document, source.nodeId, target.parallelId, target.branchId)
					: moveBlockToNewParallelBranch(document, source.nodeId, target.parallelId, target.index);
		applyDocument(next, source.nodeId);
	};

	function updateSelectedText(value: string) {
		if (!selectedNode) return;

		let next = updateBlock(document, selectedNode.id, (node) => {
			if (node.type === 'action') return { ...node, label: value };
			return { ...node, name: value };
		});

		if (selectedNode.id === document.root.id) next = { ...next, name: value };
		applyDocument(next);
	}

	function updateActionName(value: string) {
		if (selectedNode?.type !== 'action') return;

		const definition = actions.find((action) => action.name === value);
		applyDocument(
			updateBlock(document, selectedNode.id, (node) =>
				node.type === 'action'
					? {
							...node,
							action: value,
							label: humanizeIdentifier(value),
							args: {},
							device: definition?.action_type === 'device' ? node.device : undefined
						}
					: node
			)
		);
	}

	function updateActionDevice(value: string) {
		if (selectedNode?.type !== 'action') return;
		applyDocument(
			updateBlock(document, selectedNode.id, (node) =>
				node.type === 'action' ? { ...node, device: value || undefined } : node
			)
		);
	}

	function openDevicePicker() {
		if (!deviceInput) return;
		deviceInput.focus();
		try {
			deviceInput.showPicker();
		} catch {
			// Browsers without datalist picker support still focus the editable field.
		}
	}

	function parseArgumentInput(type: string | undefined, rawValue: string): YamlValue | undefined {
		if (rawValue === '') return undefined;
		const normalizedType = type?.toLowerCase() ?? '';

		if (normalizedType.includes('bool')) {
			if (rawValue === 'true') return true;
			if (rawValue === 'false') return false;
			return rawValue;
		}
		if (normalizedType.includes('int')) {
			const value = Number.parseInt(rawValue, 10);
			return Number.isFinite(value) ? value : rawValue;
		}
		if (normalizedType.includes('float')) {
			const value = Number(rawValue);
			return Number.isFinite(value) ? value : rawValue;
		}
		if (
			normalizedType.includes('dict') ||
			normalizedType.includes('list') ||
			normalizedType.includes('tuple')
		) {
			try {
				return JSON.parse(rawValue) as YamlValue;
			} catch {
				return rawValue;
			}
		}

		return rawValue;
	}

	function updateActionArgument(name: string, type: string | undefined, rawValue: string) {
		if (selectedNode?.type !== 'action') return;
		const value = parseArgumentInput(type, rawValue);

		applyDocument(
			updateBlock(document, selectedNode.id, (node) => {
				if (node.type !== 'action') return node;
				const args = { ...node.args };
				if (value === undefined) delete args[name];
				else args[name] = value;
				return { ...node, args };
			})
		);
	}

	function updateRegister(value: string) {
		if (selectedNode?.type !== 'action') return;
		applyDocument(
			updateBlock(document, selectedNode.id, (node) =>
				node.type === 'action' ? { ...node, register: value || undefined } : node
			)
		);
	}

	function updatePauseReason(value: string) {
		if (selectedNode?.type !== 'pause') return;
		applyDocument(
			updateBlock(document, selectedNode.id, (node) =>
				node.type === 'pause' ? { ...node, reason: value } : node
			)
		);
	}

	function updateLifecycle(
		field: 'delay' | 'repeat' | 'when' | 'await' | 'await_timeout' | 'until',
		rawValue: string
	) {
		if (!selectedNode || selectedNode.type === 'pause') return;
		const value =
			rawValue === ''
				? undefined
				: field === 'until' || field === 'when' || field === 'await'
					? rawValue
					: field === 'repeat'
						? Number.parseInt(rawValue, 10)
						: Number(rawValue);

		applyDocument(
			updateBlock(document, selectedNode.id, (node) =>
				node.type === 'pause' ? node : { ...node, [field]: value }
			)
		);
	}

	function updateLifecycleFlag(checked: boolean) {
		if (!selectedNode || selectedNode.type === 'pause') return;
		applyDocument(
			updateBlock(document, selectedNode.id, (node) =>
				node.type === 'pause' ? node : { ...node, update: checked || undefined }
			)
		);
	}

	function deleteSelected() {
		if (!selectedNode || selectedNode.id === document.root.id) return;
		applyDocument(removeBlock(document, selectedNode.id), document.root.id);
	}

	function copySelected() {
		if (!selectedNode) return false;
		copiedNode = selectedNode;
		return true;
	}

	function pasteCopied() {
		if (!copiedNode) return false;

		const result = pasteBlock(document, copiedNode, selectedId);
		if (!result.pastedNodeId) return false;

		applyDocument(result.document, result.pastedNodeId);
		return true;
	}

	function targetsEditableControl(event: KeyboardEvent) {
		const target = event.target;
		return (
			target instanceof HTMLElement &&
			(target.isContentEditable || Boolean(target.closest('input, textarea, select')))
		);
	}

	function handleBuilderKey(event: KeyboardEvent) {
		if (event.defaultPrevented || targetsEditableControl(event)) return;

		const key = event.key.toLowerCase();
		const copyPasteShortcut = (event.ctrlKey || event.metaKey) && !event.altKey;
		if (copyPasteShortcut && key === 'c') {
			if (copySelected()) event.preventDefault();
			return;
		}

		if (copyPasteShortcut && key === 'v') {
			if (pasteCopied()) event.preventDefault();
			return;
		}

		if (event.key !== 'Delete') return;
		if (!selectedNode || selectedNode.id === document.root.id) return;

		event.preventDefault();
		deleteSelected();
	}

	function deselectFromCanvas(event: MouseEvent) {
		const target = event.target;
		if (
			target instanceof HTMLElement &&
			target.closest('[data-sequence-canvas]') &&
			!target.closest('[data-block-id]')
		) {
			selectedId = null;
		}
	}

	function selectFirstIssue() {
		if (issues[0]) selectedId = issues[0].nodeId;
	}

	function startNewSequence(force = false) {
		if (isDirty && !force) {
			pendingCatalogName = null;
			pendingNewSequence = true;
			return;
		}

		const next = createNewSequenceDocument();
		document = next;
		selectedId = next.root.id;
		history = [];
		future = [];
		loadedCatalogName = null;
		pendingCatalogName = null;
		pendingNewSequence = false;
		isDirty = false;
		operationMessage = null;
		operationError = null;
	}

	async function loadCatalogSequence(sequenceName: string, force = false) {
		if (isDirty && !force) {
			pendingNewSequence = false;
			pendingCatalogName = sequenceName;
			return;
		}

		isLoading = true;
		pendingCatalogName = null;
		operationMessage = null;
		operationError = null;

		try {
			const yaml = await getSequenceYaml(sequenceName);
			const loadedDocument = parseSequenceYaml(yaml);
			document = loadedDocument;
			selectedId = loadedDocument.root.id;
			history = [];
			future = [];
			loadedCatalogName = sequenceName;
			isDirty = false;
			operationMessage = `Loaded “${sequenceName}” from the sequence catalog.`;
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Sequence load failed.';
		} finally {
			isLoading = false;
		}
	}

	async function refreshCatalog() {
		if (isLoading || isSaving) return;
		isLoading = true;
		operationMessage = null;
		operationError = null;

		try {
			await refreshSequenceCatalog();
			const payload = (await listSequences()) as { sequences?: unknown };
			refreshedSequenceNames = Array.isArray(payload.sequences)
				? payload.sequences.map(String)
				: [];
			savedSequenceNames = [];
			operationMessage = 'Reloaded the sequence catalog from saved YAML files.';
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Catalog refresh failed.';
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		const requestedSequence = page.url.searchParams.get('sequence');
		if (requestedSequence) void loadCatalogSequence(requestedSequence, true);
	});

	async function saveSequence() {
		if (errorCount > 0 || isSaving) {
			selectFirstIssue();
			return;
		}

		isSaving = true;
		operationMessage = null;
		operationError = null;

		try {
			const yaml = serializeSequenceYaml(document);
			const filename = sequenceYamlFilename(document.name);

			await uploadSequenceYaml(filename, yaml, true);
			await uploadSequenceYaml(filename, yaml, false, true);

			const previousName = loadedCatalogName;
			savedSequenceNames = Array.from(new Set([...savedSequenceNames, document.name]));
			loadedCatalogName = document.name;
			isDirty = false;
			operationMessage =
				previousName && previousName !== document.name
					? `Saved “${document.name}” to YAML. The previous “${previousName}” catalog entry still exists.`
					: `Saved “${document.name}” to the backend YAML catalog.`;
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Sequence save failed.';
		} finally {
			isSaving = false;
		}
	}

	function updateDescription(value: string) {
		applyDocument({ ...document, description: value || undefined });
	}

	function nodeIcon(node: SequenceBlock) {
		if (node.type === 'action') return '■';
		if (node.type === 'sequence') return '▤';
		if (node.type === 'parallel') return '⑂';
		return 'Ⅱ';
	}

	function actionArgumentInputValue(value: YamlValue | undefined) {
		if (value === undefined) return '';
		if (typeof value === 'object') return JSON.stringify(value);
		return String(value);
	}

	function isBooleanType(type: string | undefined) {
		return type?.toLowerCase().includes('bool') ?? false;
	}

	function isNumericType(type: string | undefined) {
		const normalized = type?.toLowerCase() ?? '';
		return normalized.includes('int') || normalized.includes('float');
	}
</script>

<svelte:window onkeydown={handleBuilderKey} onclick={deselectFromCanvas} />

<svelte:head>
	<title>Sequence Builder | Alpaquero</title>
	<meta
		name="description"
		content="Visual builder for ordered and parallel observatory sequences"
	/>
</svelte:head>

<main
	class="grid h-screen grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden bg-neutral-950 p-2 text-neutral-100"
>
	<header
		class="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-2 border-neutral-700 bg-neutral-900 p-2 shadow-[4px_4px_0_#80499c]"
	>
		<div class="flex min-w-0 items-center gap-3">
			<a href={resolve('/')} aria-label="Back to Alpaquero dashboard" class="shrink-0">
				<img src={logo} alt="" class="size-9 object-contain" />
			</a>
			<div class="min-w-0">
				<p class="truncate text-[0.65rem] font-black tracking-[0.14em] text-neutral-500 uppercase">
					Automation <span class="text-neutral-700">/</span> Sequence Builder
				</p>
				<h1 class="truncate text-base leading-tight font-black uppercase">{document.name}</h1>
			</div>
		</div>

		<div class="flex items-center gap-1.5">
			<button
				type="button"
				onclick={undo}
				disabled={history.length === 0}
				class="border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs font-black uppercase hover:border-neutral-300 disabled:cursor-not-allowed disabled:text-neutral-700"
				title="Undo"
			>
				↶
			</button>
			<button
				type="button"
				onclick={redo}
				disabled={future.length === 0}
				class="border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs font-black uppercase hover:border-neutral-300 disabled:cursor-not-allowed disabled:text-neutral-700"
				title="Redo"
			>
				↷
			</button>
			<button
				type="button"
				onclick={copySelected}
				disabled={!selectedNode}
				class="border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-[0.65rem] font-black uppercase hover:border-neutral-300 disabled:cursor-not-allowed disabled:text-neutral-700"
				title="Copy selected node (Ctrl+C)"
			>
				Copy
			</button>
			<button
				type="button"
				onclick={pasteCopied}
				disabled={!copiedNode}
				class="border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-[0.65rem] font-black uppercase hover:border-neutral-300 disabled:cursor-not-allowed disabled:text-neutral-700"
				title="Paste copied node (Ctrl+V)"
			>
				Paste
			</button>
			<button
				type="button"
				onclick={selectFirstIssue}
				class="border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-[0.65rem] font-black uppercase hover:border-[#80499c]"
			>
				Validate
			</button>
			<button
				type="button"
				onclick={saveSequence}
				disabled={isSaving || isLoading || errorCount > 0}
				title={errorCount > 0
					? 'Resolve validation errors before saving'
					: 'Validate and register YAML in the backend’s in-memory sequence catalog'}
				class="w-20 border border-[#80499c] bg-[#211428] px-3 py-1.5 text-[0.65rem] font-black text-purple-200 uppercase hover:bg-[#392044] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isSaving ? 'Saving…' : 'Save'}
			</button>
			<a
				href={resolve('/')}
				data-control
				class="border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-[0.65rem] font-black uppercase hover:border-neutral-300"
			>
				Close
			</a>
		</div>
	</header>

	<DragDropProvider plugins={dragDropPlugins} onDragEnd={handleDragEnd}>
		<section
			class="grid min-h-0 gap-2 xl:grid-cols-[15rem_minmax(0,1fr)_21rem]"
			aria-label="Sequence builder workspace"
		>
			<aside
				class="flex min-h-0 max-w-full min-w-0 flex-col overflow-hidden border-2 border-neutral-700 bg-neutral-900 shadow-[4px_4px_0_#80499c]"
			>
				<section
					class="shrink-0 border-b-2 border-neutral-700 bg-neutral-950/40 p-2"
					aria-labelledby="loaded-sequences-heading"
				>
					<div class="mb-2 flex items-center justify-between gap-2">
						<h2 id="loaded-sequences-heading" class="text-sm font-black uppercase">
							Loaded Sequences
						</h2>
						<div class="flex gap-1">
							<button
								type="button"
								onclick={() => startNewSequence()}
								disabled={isLoading || isSaving}
								class="border border-[#80499c] bg-[#211428] px-1.5 py-0.5 text-[0.5rem] font-black text-purple-200 uppercase hover:bg-[#392044] disabled:opacity-50"
							>
								New
							</button>
							<button
								type="button"
								onclick={refreshCatalog}
								disabled={isLoading || isSaving}
								class="border border-neutral-600 bg-neutral-950 px-1.5 py-0.5 text-[0.5rem] font-black uppercase hover:border-sky-500 disabled:opacity-50"
							>
								Refresh
							</button>
						</div>
					</div>

					{#if data.catalogError}
						<p
							class="mb-2 border border-yellow-700 bg-yellow-950 p-1.5 text-[0.6rem] text-yellow-100"
						>
							{data.catalogError}
						</p>
					{/if}
					{#if operationMessage}
						<p
							role="status"
							class="mb-2 border border-emerald-800 bg-emerald-950 p-1.5 text-[0.6rem] text-emerald-100"
						>
							{operationMessage}
						</p>
					{/if}
					{#if operationError}
						<p
							role="alert"
							class="mb-2 border border-red-800 bg-red-950 p-1.5 text-[0.6rem] text-red-100"
						>
							{operationError}
						</p>
					{/if}
					{#if pendingNewSequence}
						<div class="mb-2 border border-amber-700 bg-amber-950 p-2 text-[0.6rem]">
							<p class="text-amber-100">Starting a new sequence will discard unsaved edits.</p>
							<div class="mt-2 flex gap-1">
								<button
									type="button"
									onclick={() => startNewSequence(true)}
									class="border border-amber-500 px-2 py-1 font-black text-amber-100 uppercase"
								>
									Start new
								</button>
								<button
									type="button"
									onclick={() => (pendingNewSequence = false)}
									class="border border-neutral-600 px-2 py-1 font-black text-neutral-300 uppercase"
								>
									Cancel
								</button>
							</div>
						</div>
					{/if}
					{#if pendingCatalogName}
						<div class="mb-2 border border-amber-700 bg-amber-950 p-2 text-[0.6rem]">
							<p class="text-amber-100">
								Loading "{pendingCatalogName}" will discard unsaved edits.
							</p>
							<div class="mt-2 flex gap-1">
								<button
									type="button"
									onclick={() => loadCatalogSequence(pendingCatalogName!, true)}
									class="border border-amber-500 px-2 py-1 font-black text-amber-100 uppercase"
								>
									Load anyway
								</button>
								<button
									type="button"
									onclick={() => (pendingCatalogName = null)}
									class="border border-neutral-600 px-2 py-1 font-black text-neutral-300 uppercase"
								>
									Cancel
								</button>
							</div>
						</div>
					{/if}

					<div class="grid max-h-32 gap-1 overflow-y-auto pr-1">
						{#each catalogSequences as sequence (sequence)}
							<button
								type="button"
								aria-label={`Load sequence ${sequence}`}
								onclick={() => loadCatalogSequence(sequence)}
								disabled={isLoading || isSaving}
								class="flex items-center justify-between gap-2 border bg-neutral-950 px-2 py-1.5 text-left text-[0.65rem] hover:border-sky-500 disabled:opacity-50"
								class:border-sky-600={loadedCatalogName === sequence}
								class:text-sky-200={loadedCatalogName === sequence}
								class:border-neutral-700={loadedCatalogName !== sequence}
							>
								<span class="truncate">{sequence}</span>
								<span class="text-[0.5rem] font-black uppercase">
									{isLoading ? '...' : loadedCatalogName === sequence ? 'Loaded' : 'Load'}
								</span>
							</button>
						{:else}
							<p class="text-[0.65rem] text-neutral-600">No catalog sequences available.</p>
						{/each}
					</div>
				</section>

				<div class="shrink-0 p-2">
					<div class="mb-2 border-b-2 border-neutral-700 pb-2">
						<h2 class="text-sm font-black uppercase">Block Library</h2>
					</div>
					<label>
						<span class="sr-only">Search blocks and actions</span>
						<input
							bind:value={librarySearch}
							placeholder="Search actions..."
							class="w-full border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs outline-none placeholder:text-neutral-600 focus:border-[#80499c]"
						/>
					</label>
				</div>

				<div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
					<p class="mb-1 text-[0.6rem] font-black tracking-widest text-neutral-500 uppercase">
						Structure
					</p>
					<div class="grid gap-1.5">
						{#each visibleStructuralItems as item (item.blockType)}
							<BuilderLibraryItem {...item} />
						{/each}
					</div>

					<p class="mt-4 mb-1 text-[0.6rem] font-black tracking-widest text-neutral-500 uppercase">
						Actions
					</p>
					<div class="grid gap-1.5">
						{#each visibleActions as action (action.name)}
							<BuilderLibraryItem
								blockType="action"
								actionName={action.name}
								label={humanizeIdentifier(action.name)}
								icon="■"
							/>
						{:else}
							<p
								class="border border-dashed border-neutral-700 p-2 text-[0.65rem] text-neutral-500"
							>
								No action matches the current search.
							</p>
						{/each}
					</div>
				</div>
			</aside>

			<section
				class="flex min-h-0 min-w-0 flex-col overflow-hidden border-2 border-neutral-700 bg-neutral-900 shadow-[4px_4px_0_#80499c]"
			>
				<div class="min-h-0 flex-1 overflow-auto bg-neutral-950/80 p-4" data-sequence-canvas>
					<div class="mx-auto max-w-6xl min-w-[42rem]">
						<BlockNode
							node={document.root}
							{selectedId}
							{issues}
							{actions}
							onSelect={(nodeId) => (selectedId = nodeId)}
							isRoot={true}
						/>
					</div>
				</div>
			</section>

			<aside
				class="flex min-h-0 max-w-full min-w-0 flex-col overflow-hidden border-2 border-neutral-700 bg-neutral-900 shadow-[4px_4px_0_#80499c]"
			>
				<div class="shrink-0 border-b-2 border-neutral-700 p-2">
					<h2 class="text-sm font-black uppercase">Inspector</h2>
				</div>

				{#if selectedNode}
					<div class="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3">
						<div class="mb-4 flex items-start gap-2">
							<div
								class="grid size-11 shrink-0 place-items-center border text-lg"
								class:border-emerald-600={selectedNode.type === 'action'}
								class:bg-emerald-950={selectedNode.type === 'action'}
								class:text-emerald-200={selectedNode.type === 'action'}
								class:border-sky-600={selectedNode.type === 'sequence'}
								class:bg-sky-950={selectedNode.type === 'sequence'}
								class:text-sky-200={selectedNode.type === 'sequence'}
								class:border-fuchsia-600={selectedNode.type === 'parallel'}
								class:bg-fuchsia-950={selectedNode.type === 'parallel'}
								class:text-fuchsia-200={selectedNode.type === 'parallel'}
								class:border-amber-600={selectedNode.type === 'pause'}
								class:bg-amber-950={selectedNode.type === 'pause'}
								class:text-amber-200={selectedNode.type === 'pause'}
							>
								{nodeIcon(selectedNode)}
							</div>
							<div class="min-w-0">
								<p class="text-[0.6rem] font-black tracking-widest text-neutral-500 uppercase">
									{selectedNode.type}
								</p>
								<p class="truncate text-sm font-black">{nodeLabel(selectedNode)}</p>
							</div>
						</div>

						<div class="grid min-w-0 gap-3 border-t border-neutral-700 pt-3">
							<label class="grid min-w-0 gap-1">
								<span class="text-[0.6rem] font-black text-neutral-400 uppercase">
									{selectedNode.type === 'action' ? 'Display label' : 'Name'}
								</span>
								<input
									value={nodeLabel(selectedNode)}
									onchange={(event) => updateSelectedText(event.currentTarget.value)}
									class="max-w-full min-w-0 border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
								/>
							</label>

							{#if selectedNode.id === document.root.id}
								<label class="grid min-w-0 gap-1">
									<span class="text-[0.6rem] font-black text-neutral-400 uppercase">
										Description
									</span>
									<textarea
										rows="3"
										value={document.description ?? ''}
										placeholder="Optional catalog description"
										oninput={(event) => updateDescription(event.currentTarget.value)}
										class="max-w-full min-w-0 resize-y border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
									></textarea>
								</label>
							{/if}

							{#if selectedNode.type === 'action'}
								<label class="grid min-w-0 gap-1">
									<span class="text-[0.6rem] font-black text-neutral-400 uppercase">
										Registry action
									</span>
									<select
										value={selectedNode.action}
										onchange={(event) => updateActionName(event.currentTarget.value)}
										class="max-w-full min-w-0 border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
									>
										{#each actions as action (action.name)}
											<option value={action.name}>{action.name}</option>
										{/each}
									</select>
								</label>

								{#if selectedActionDefinition?.action_type === 'device'}
									<label class="grid min-w-0 gap-1">
										<span
											class="flex min-w-0 items-center justify-between gap-2 text-[0.6rem] font-black text-neutral-300 uppercase"
										>
											<span>Device</span>
											<span
												class="shrink-0 border border-sky-800 bg-sky-950 px-1.5 py-0.5 text-[0.5rem] tracking-wide text-sky-300"
											>
												Choose configured ID
											</span>
										</span>
										<span class="relative block min-w-0">
											<input
												bind:this={deviceInput}
												list="configured-sequence-devices"
												value={selectedNode.device ?? ''}
												placeholder={'Select device or enter {{ args.device_id }}'}
												oninput={(event) => updateActionDevice(event.currentTarget.value)}
												class="w-full min-w-0 border-2 border-sky-700 bg-[#07141d] py-2 pr-14 pl-2 text-xs text-sky-50 transition-colors outline-none hover:border-sky-500 focus:border-sky-300"
											/>
											<button
												type="button"
												onclick={openDevicePicker}
												aria-label="Open configured device options"
												title="Show configured devices"
												class="absolute inset-y-0 right-0 grid w-12 place-items-center border-l-2 border-sky-700 bg-sky-950 text-sky-200 transition-colors hover:bg-sky-900 hover:text-white"
											>
												<span
													aria-hidden="true"
													class="size-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-sky-200"
												></span>
											</button>
										</span>
										<datalist id="configured-sequence-devices">
											{#each devices as device (device.id)}
												<option value={device.id}>{device.name ?? device.id} · {device.type}</option
												>
											{/each}
										</datalist>
										<span class="text-[0.55rem] text-neutral-600">
											Select a configured ID or enter a runtime argument template.
										</span>
									</label>
								{/if}

								<div class="grid min-w-0 gap-2 border-t border-neutral-700 pt-3">
									<div class="flex min-w-0 flex-wrap items-center justify-between gap-1">
										<p class="text-[0.6rem] font-black text-neutral-400 uppercase">Arguments</p>
										<span class="text-[0.55rem] text-neutral-600">
											{selectedActionDefinition?.args.length ?? 0} from registry
										</span>
									</div>
									<p class="text-[0.55rem] leading-relaxed text-neutral-600">
										Every argument accepts literals or templates such as
										<code class="text-sky-300">{'{{ args.exposure }}'}</code> and
										<code class="text-sky-300">{'{{ capture.result }}'}</code>.
									</p>

									{#each selectedActionDefinition?.args ?? [] as argument (argument.name)}
										<label class="grid min-w-0 gap-1">
											<span class="flex items-center justify-between gap-2">
												<span class="min-w-0 text-[0.6rem] font-black break-all text-neutral-300">
													{argument.name}
													{#if argument.primary}
														<span class="ml-1 text-emerald-300 uppercase">primary</span>
													{/if}
													{#if argument.name === 'override'}
														<span class="ml-1 text-red-300 uppercase">safety bypass</span>
													{/if}
												</span>
												<span class="text-[0.55rem] text-neutral-600"
													>{argument.type ?? 'untyped'}</span
												>
											</span>

											{#if isBooleanType(argument.type)}
												<input
													aria-label={`Argument ${argument.name}`}
													value={actionArgumentInputValue(selectedNode.args[argument.name])}
													placeholder={'true, false, or {{ path }}'}
													oninput={(event) =>
														updateActionArgument(
															argument.name,
															argument.type,
															event.currentTarget.value
														)}
													class="max-w-full min-w-0 border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
												/>
											{:else if isNumericType(argument.type)}
												<input
													type="text"
													inputmode="decimal"
													aria-label={`Argument ${argument.name}`}
													value={actionArgumentInputValue(selectedNode.args[argument.name])}
													placeholder={'Number or {{ path }}'}
													oninput={(event) =>
														updateActionArgument(
															argument.name,
															argument.type,
															event.currentTarget.value
														)}
													class="max-w-full min-w-0 border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
												/>
											{:else if argument.type?.toLowerCase().includes('dict') || argument.type
													?.toLowerCase()
													.includes('list') || argument.type?.toLowerCase().includes('tuple')}
												<textarea
													aria-label={`Argument ${argument.name}`}
													rows="3"
													value={actionArgumentInputValue(selectedNode.args[argument.name])}
													placeholder="Unset or JSON object"
													oninput={(event) =>
														updateActionArgument(
															argument.name,
															argument.type,
															event.currentTarget.value
														)}
													class="max-w-full min-w-0 resize-y border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
												></textarea>
											{:else}
												<input
													aria-label={`Argument ${argument.name}`}
													value={actionArgumentInputValue(selectedNode.args[argument.name])}
													placeholder="Unset"
													oninput={(event) =>
														updateActionArgument(
															argument.name,
															argument.type,
															event.currentTarget.value
														)}
													class="max-w-full min-w-0 border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
												/>
											{/if}
											{#if argument.name === 'override'}
												<span class="text-[0.55rem] leading-relaxed text-red-300">
													Setting this to true bypasses the action's safety checks.
												</span>
											{/if}
										</label>
									{:else}
										<p
											class="border border-dashed border-neutral-700 p-2 text-[0.65rem] text-neutral-500"
										>
											This action exposes no arguments.
										</p>
									{/each}
								</div>

								<label class="grid min-w-0 gap-1">
									<span class="text-[0.6rem] font-black text-neutral-400 uppercase">
										Register result as
									</span>
									<input
										value={selectedNode.register ?? ''}
										placeholder="Optional identifier"
										onchange={(event) => updateRegister(event.currentTarget.value)}
										class="max-w-full min-w-0 border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
									/>
								</label>
							{:else if selectedNode.type === 'pause'}
								<label class="grid min-w-0 gap-1">
									<span class="text-[0.6rem] font-black text-neutral-400 uppercase">Reason</span>
									<textarea
										rows="3"
										value={selectedNode.reason ?? ''}
										onchange={(event) => updatePauseReason(event.currentTarget.value)}
										class="max-w-full min-w-0 resize-y border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
									></textarea>
								</label>
							{/if}

							{#if selectedNode.type !== 'pause'}
								<div class="grid min-w-0 gap-2 border-t border-neutral-700 pt-3">
									<div class="flex items-center justify-between gap-2">
										<p class="text-[0.6rem] font-black text-neutral-400 uppercase">
											Lifecycle & conditions
										</p>
										<label class="flex min-w-0 items-center gap-1.5 text-[0.6rem] text-neutral-300">
											<input
												type="checkbox"
												checked={selectedNode.update ?? false}
												onchange={(event) => updateLifecycleFlag(event.currentTarget.checked)}
												class="accent-[#80499c]"
											/>
											Publish updates
										</label>
									</div>

									<div class="grid min-w-0 grid-cols-2 gap-2">
										<label class="grid min-w-0 gap-1">
											<span class="text-[0.6rem] font-black text-neutral-400 uppercase">
												Delay seconds
											</span>
											<input
												type="number"
												min="0"
												step="1"
												value={selectedNode.delay ?? ''}
												placeholder="0"
												onchange={(event) => updateLifecycle('delay', event.currentTarget.value)}
												class="max-w-full min-w-0 border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
											/>
										</label>
										<label class="grid min-w-0 gap-1">
											<span class="text-[0.6rem] font-black text-neutral-400 uppercase">
												Repeat
											</span>
											<input
												type="number"
												min="1"
												step="1"
												value={selectedNode.repeat ?? ''}
												placeholder="1"
												onchange={(event) => updateLifecycle('repeat', event.currentTarget.value)}
												class="max-w-full min-w-0 border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
											/>
										</label>
									</div>

									<label class="grid min-w-0 gap-1">
										<span class="text-[0.6rem] font-black text-neutral-400 uppercase">
											Await before starting
										</span>
										<input
											list="sequence-condition-expressions"
											value={selectedNode.await ?? ''}
											placeholder={'{{ conditions.weather_is_safe() }}'}
											oninput={(event) => updateLifecycle('await', event.currentTarget.value)}
											class="max-w-full min-w-0 border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
										/>
									</label>

									<label class="grid min-w-0 gap-1">
										<span class="text-[0.6rem] font-black text-neutral-400 uppercase">
											Await timeout seconds
										</span>
										<input
											type="number"
											min="0"
											step="1"
											disabled={!selectedNode.await}
											value={selectedNode.await_timeout ?? ''}
											placeholder="No timeout"
											onchange={(event) =>
												updateLifecycle('await_timeout', event.currentTarget.value)}
											class="max-w-full min-w-0 border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c] disabled:opacity-40"
										/>
									</label>

									<label class="grid min-w-0 gap-1">
										<span class="text-[0.6rem] font-black text-neutral-400 uppercase">
											Run each repetition when
										</span>
										<input
											list="sequence-condition-expressions"
											value={selectedNode.when ?? ''}
											placeholder={'{{ args.enabled }}'}
											oninput={(event) => updateLifecycle('when', event.currentTarget.value)}
											class="max-w-full min-w-0 border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
										/>
									</label>

									<label class="grid min-w-0 gap-1">
										<span class="text-[0.6rem] font-black text-neutral-400 uppercase">
											Until time or condition
										</span>
										<input
											list="sequence-condition-expressions"
											value={selectedNode.until ?? ''}
											placeholder={'HH:MM or {{ condition }}'}
											oninput={(event) => updateLifecycle('until', event.currentTarget.value)}
											class="max-w-full min-w-0 border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-[#80499c]"
										/>
									</label>

									<datalist id="sequence-condition-expressions">
										{#each conditions as condition (condition.name)}
											<option value={conditionExample(condition.name)}></option>
										{/each}
									</datalist>

									<details class="min-w-0 border border-neutral-700 bg-neutral-950/60 p-2">
										<summary class="cursor-pointer text-[0.6rem] font-black text-sky-300 uppercase">
											Available conditions · {conditions.length}
										</summary>
										<div class="mt-2 grid min-w-0 gap-1.5">
											{#each conditions as condition (condition.name)}
												<div class="min-w-0 text-[0.58rem]">
													<code class="break-all text-neutral-200">
														{conditionExample(condition.name)}
													</code>
													{#if condition.args.length > 0}
														<p class="mt-0.5 break-words text-neutral-600">
															Args:
															{condition.args
																.map(
																	(argument) => `${argument.name}${argument.required ? '' : '?'}`
																)
																.join(', ')}
														</p>
													{/if}
												</div>
											{:else}
												<p class="text-neutral-600">No condition metadata is available.</p>
											{/each}
										</div>
									</details>
								</div>
							{/if}
						</div>

						{#if selectedNodeIssues.length > 0}
							<div class="mt-4 grid gap-1 border-t border-neutral-700 pt-3">
								<p class="text-[0.6rem] font-black text-neutral-400 uppercase">Validation</p>
								{#each selectedNodeIssues as issue (issue.id)}
									<p
										class="border px-2 py-1.5 text-[0.65rem]"
										class:border-red-600={issue.severity === 'error'}
										class:bg-red-950={issue.severity === 'error'}
										class:text-red-100={issue.severity === 'error'}
										class:border-yellow-700={issue.severity === 'warning'}
										class:bg-yellow-950={issue.severity === 'warning'}
										class:text-yellow-100={issue.severity === 'warning'}
									>
										{issue.message}
									</p>
								{/each}
							</div>
						{/if}
					</div>

					<div class="shrink-0 border-t-2 border-neutral-700 p-3">
						<button
							type="button"
							onclick={deleteSelected}
							disabled={selectedNode.id === document.root.id}
							class="w-full border border-red-800 bg-neutral-950 px-2 py-2 text-[0.65rem] font-black text-red-300 uppercase hover:bg-red-950 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-700"
						>
							Delete block
						</button>
					</div>
				{:else}
					<p class="m-3 border border-dashed border-neutral-700 p-2 text-xs text-neutral-500">
						Select a block to edit it.
					</p>
				{/if}
			</aside>
		</section>
	</DragDropProvider>
</main>
