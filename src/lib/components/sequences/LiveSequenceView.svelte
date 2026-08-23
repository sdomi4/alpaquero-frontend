<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getLiveSequenceTree } from '$lib/api/observatory';
	import {
		compactLiveNodeIds,
		isTreeBuildPending,
		parseLiveSequenceTree,
		type LiveSequenceIndex,
		type LiveSequenceState
	} from '$lib/live-sequences';
	import LiveSequenceNode from './LiveSequenceNode.svelte';

	type Props = {
		sequences: Record<string, LiveSequenceState>;
	};

	let { sequences }: Props = $props();

	let selectedContextId = $state('');
	let cachedStates = $state<Record<string, LiveSequenceState>>({});
	let knownContextIds = $state<string[]>([]);
	let trees = $state<Record<string, LiveSequenceIndex>>({});
	let loadStatus = $state<Record<string, 'loading' | 'loaded' | 'error'>>({});
	let loadErrors = $state<Record<string, string>>({});
	let showAll = $state(false);
	const loadingContexts = new SvelteSet<string>();

	const selectedState = $derived(cachedStates[selectedContextId] ?? null);
	const selectedTree = $derived(trees[selectedContextId] ?? null);
	const isLive = $derived(Boolean(sequences[selectedContextId]));
	const activeSteps = $derived(selectedState?.steps ?? {});
	const visibleNodeIds = $derived(
		selectedTree ? compactLiveNodeIds(selectedTree, activeSteps) : new Set<string>()
	);
	const unknownActiveIds = $derived(
		selectedTree ? Object.keys(activeSteps).filter((stepId) => !selectedTree.byId.has(stepId)) : []
	);

	$effect(() => {
		const liveEntries = Object.entries(sequences ?? {});
		if (liveEntries.length === 0) return;

		const nextCached = { ...untrack(() => cachedStates) };
		const nextIds = [...untrack(() => knownContextIds)];

		for (const [contextId, state] of liveEntries) {
			nextCached[contextId] = state;
			if (!nextIds.includes(contextId)) nextIds.push(contextId);
			void loadTree(contextId);
		}

		cachedStates = nextCached;
		knownContextIds = nextIds;

		if (!selectedContextId || !nextIds.includes(selectedContextId)) {
			selectedContextId = liveEntries[0][0];
		}
	});

	async function loadTree(contextId: string, force = false) {
		if (loadingContexts.has(contextId)) return;
		if (!force && untrack(() => trees[contextId])) return;

		loadingContexts.add(contextId);
		loadStatus = { ...loadStatus, [contextId]: 'loading' };
		const nextErrors = { ...loadErrors };
		delete nextErrors[contextId];
		loadErrors = nextErrors;

		try {
			for (let attempt = 0; attempt < 25; attempt += 1) {
				if (!untrack(() => sequences[contextId])) {
					throw new Error('The execution is no longer active.');
				}

				const response = await getLiveSequenceTree(contextId);

				if (isTreeBuildPending(response)) {
					await new Promise((resolve) => setTimeout(resolve, 200));
					continue;
				}

				const index = parseLiveSequenceTree(response);
				trees = { ...trees, [contextId]: index };
				loadStatus = { ...loadStatus, [contextId]: 'loaded' };
				return;
			}

			throw new Error('The runtime tree was not ready in time.');
		} catch (error) {
			loadStatus = { ...loadStatus, [contextId]: 'error' };
			loadErrors = {
				...loadErrors,
				[contextId]: error instanceof Error ? error.message : 'Unable to load the runtime tree.'
			};
		} finally {
			loadingContexts.delete(contextId);
		}
	}
</script>

<section
	class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-neutral-950"
	aria-label="Live sequence viewer"
>
	<header class="grid gap-2 border-b-2 border-neutral-700 bg-neutral-900 p-2">
		<div class="flex min-w-0 items-center justify-between gap-2">
			<div class="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
				{#each knownContextIds as contextId (contextId)}
					{@const state = cachedStates[contextId]}
					<button
						type="button"
						onclick={() => {
							selectedContextId = contextId;
						}}
						class="shrink-0 border px-2.5 py-1 font-mono text-[0.65rem] font-black uppercase"
						class:border-[#80499c]={selectedContextId === contextId}
						class:bg-[#211428]={selectedContextId === contextId}
						class:text-purple-100={selectedContextId === contextId}
						class:border-neutral-700={selectedContextId !== contextId}
						class:text-neutral-400={selectedContextId !== contextId}
					>
						{state?.sequence_name ?? contextId}
					</button>
				{/each}
			</div>

			<button
				type="button"
				onclick={() => {
					showAll = !showAll;
				}}
				class="w-28 shrink-0 border border-neutral-600 bg-neutral-950 px-2.5 py-1 text-center font-mono text-[0.65rem] font-black text-neutral-300 uppercase hover:bg-neutral-800"
				aria-pressed={showAll}
			>
				{showAll ? 'Active window' : 'Show all'}
			</button>
		</div>

		{#if selectedState}
			<div
				class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.65rem] uppercase"
			>
				<span
					class="border px-1.5 py-0.5 font-black"
					class:border-emerald-500={isLive && selectedState.status.toLowerCase() === 'running'}
					class:text-emerald-200={isLive && selectedState.status.toLowerCase() === 'running'}
					class:border-amber-500={isLive && selectedState.status.toLowerCase() === 'paused'}
					class:text-amber-200={isLive && selectedState.status.toLowerCase() === 'paused'}
					class:border-neutral-600={!isLive ||
						!['running', 'paused'].includes(selectedState.status.toLowerCase())}
					class:text-neutral-300={!isLive ||
						!['running', 'paused'].includes(selectedState.status.toLowerCase())}
				>
					{isLive ? selectedState.status : 'no longer active'}
				</span>
				<span
					class="min-w-0 flex-1 truncate text-neutral-300"
					title={selectedState.info ?? undefined}
				>
					{selectedState.info || 'Waiting for activity'}
				</span>
				<span class="text-neutral-600" title={`Execution ${selectedContextId}`}>
					{selectedContextId}
				</span>
			</div>
		{/if}
	</header>

	<div class="min-h-0 overflow-auto p-3">
		{#if knownContextIds.length === 0}
			<div
				class="grid h-full place-items-center border border-dashed border-neutral-700 p-4 text-center font-mono text-sm text-neutral-500"
			>
				No sequence is currently running.
			</div>
		{:else if loadStatus[selectedContextId] === 'loading' || !loadStatus[selectedContextId]}
			<div class="grid h-full place-items-center font-mono text-sm text-neutral-400">
				Loading runtime tree...
			</div>
		{:else if loadStatus[selectedContextId] === 'error'}
			<div
				class="grid place-items-center gap-3 border-2 border-red-800 bg-red-950/40 p-4 text-center font-mono text-sm text-red-100"
			>
				<p>{loadErrors[selectedContextId]}</p>
				{#if isLive}
					<button
						type="button"
						onclick={() => loadTree(selectedContextId, true)}
						class="border border-red-400 bg-red-950 px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0_#ef4444]"
					>
						Retry
					</button>
				{/if}
			</div>
		{:else if selectedTree}
			<div class="mx-auto grid w-full max-w-5xl gap-2">
				{#if unknownActiveIds.length > 0}
					<p class="border border-amber-700 bg-amber-950/50 p-2 font-mono text-xs text-amber-200">
						{unknownActiveIds.length} active {unknownActiveIds.length === 1
							? 'step is'
							: 'steps are'} missing from the runtime tree.
					</p>
				{/if}

				<LiveSequenceNode
					node={selectedTree.root}
					{activeSteps}
					{visibleNodeIds}
					{showAll}
					isRoot
				/>
			</div>
		{/if}
	</div>
</section>
