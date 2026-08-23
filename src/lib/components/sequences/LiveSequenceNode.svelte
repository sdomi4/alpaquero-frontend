<script lang="ts">
	import LiveSequenceNode from './LiveSequenceNode.svelte';
	import {
		nonDefaultLiveLifecycleEntries,
		type LiveSequenceNode as LiveNode
	} from '$lib/live-sequences';

	type Props = {
		node: LiveNode;
		activeSteps: Record<string, number>;
		visibleNodeIds: Set<string>;
		showAll: boolean;
		isRoot?: boolean;
	};

	let { node, activeSteps, visibleNodeIds, showAll, isRoot = false }: Props = $props();

	const isActive = $derived(activeSteps[node.id] !== undefined);
	const repetition = $derived(activeSteps[node.id] ?? null);
	const configuredRepeat = $derived(
		typeof node.lifecycle.repeat === 'number' ? node.lifecycle.repeat : null
	);
	const lifecycleEntries = $derived(
		nonDefaultLiveLifecycleEntries(node.lifecycle).filter((entry) => entry.name !== 'repeat')
	);
	const visibleChildren = $derived(
		node.children.filter((child) => showAll || visibleNodeIds.has(child.id))
	);
	const friendlyType = $derived(
		node.type === 'Task'
			? 'action'
			: node.type === 'ParallelGroup'
				? 'parallel'
				: node.type === 'PauseStep'
					? 'pause'
					: node.type.toLowerCase()
	);
</script>

<article
	class="min-w-0 border transition-colors"
	class:border-2={isActive}
	class:border-emerald-300={isActive && node.type === 'Task'}
	class:border-sky-300={isActive && node.type === 'Sequence'}
	class:border-fuchsia-300={isActive && node.type === 'ParallelGroup'}
	class:border-amber-300={isActive && node.type === 'PauseStep'}
	class:border-neutral-100={isActive &&
		!['Task', 'Sequence', 'ParallelGroup', 'PauseStep'].includes(node.type)}
	class:border-emerald-800={!isActive && node.type === 'Task'}
	class:border-sky-800={!isActive && node.type === 'Sequence'}
	class:border-fuchsia-800={!isActive && node.type === 'ParallelGroup'}
	class:border-amber-800={!isActive && node.type === 'PauseStep'}
	class:border-neutral-700={!isActive &&
		!['Task', 'Sequence', 'ParallelGroup', 'PauseStep'].includes(node.type)}
	class:bg-[#15251a]={node.type === 'Task'}
	class:bg-[#101d27]={node.type === 'Sequence'}
	class:bg-[#271022]={node.type === 'ParallelGroup'}
	class:bg-[#2a2110]={node.type === 'PauseStep'}
	class:bg-neutral-900={!['Task', 'Sequence', 'ParallelGroup', 'PauseStep'].includes(node.type)}
	class:opacity-60={!isActive && !isRoot}
	class:shadow-[3px_3px_0_#d1fae5]={isActive && node.type === 'Task'}
	class:shadow-[3px_3px_0_#bae6fd]={isActive && node.type === 'Sequence'}
	class:shadow-[3px_3px_0_#f5d0fe]={isActive && node.type === 'ParallelGroup'}
	data-live-step-id={node.id}
	data-active={isActive}
>
	<header
		class="flex min-h-8 flex-wrap items-center gap-1.5 px-2 py-1.5"
		class:border-b={visibleChildren.length > 0}
		class:border-sky-800={node.type === 'Sequence'}
		class:border-fuchsia-800={node.type === 'ParallelGroup'}
		class:border-neutral-700={!['Sequence', 'ParallelGroup'].includes(node.type)}
	>
		<span
			class="shrink-0 text-[0.6rem] font-black tracking-wider uppercase"
			class:text-emerald-300={node.type === 'Task'}
			class:text-sky-300={node.type === 'Sequence'}
			class:text-fuchsia-300={node.type === 'ParallelGroup'}
			class:text-amber-300={node.type === 'PauseStep'}
			class:text-neutral-300={!['Task', 'Sequence', 'ParallelGroup', 'PauseStep'].includes(
				node.type
			)}
		>
			{friendlyType}
		</span>

		<span class="min-w-24 flex-1 truncate text-xs font-semibold text-neutral-100" title={node.name}>
			{node.name}
		</span>

		{#each lifecycleEntries as entry (entry.name)}
			<span
				class="max-w-56 shrink-0 truncate border px-1.5 py-0.5 text-[0.52rem] font-black uppercase"
				class:border-cyan-800={['await', 'await_timeout'].includes(entry.name)}
				class:bg-cyan-950={['await', 'await_timeout'].includes(entry.name)}
				class:text-cyan-200={['await', 'await_timeout'].includes(entry.name)}
				class:border-violet-800={entry.name === 'when'}
				class:bg-violet-950={entry.name === 'when'}
				class:text-violet-200={entry.name === 'when'}
				class:border-amber-800={entry.name === 'until'}
				class:bg-amber-950={entry.name === 'until'}
				class:text-amber-200={entry.name === 'until'}
				class:border-sky-800={entry.name === 'update'}
				class:bg-sky-950={entry.name === 'update'}
				class:text-sky-200={entry.name === 'update'}
				class:border-rose-800={['on_error', 'finally'].includes(entry.name)}
				class:bg-rose-950={['on_error', 'finally'].includes(entry.name)}
				class:text-rose-200={['on_error', 'finally'].includes(entry.name)}
				class:border-neutral-700={![
					'await',
					'await_timeout',
					'when',
					'until',
					'update',
					'on_error',
					'finally'
				].includes(entry.name)}
				class:text-neutral-300={![
					'await',
					'await_timeout',
					'when',
					'until',
					'update',
					'on_error',
					'finally'
				].includes(entry.name)}
				title={`${entry.label}: ${entry.value}`}
				data-lifecycle-hook={entry.name}
			>
				{entry.label} · {entry.value}
			</span>
		{/each}

		{#if isActive}
			<span
				class="shrink-0 border border-neutral-100 bg-neutral-950 px-1.5 py-0.5 text-[0.55rem] font-black text-neutral-100 uppercase"
			>
				active
			</span>
		{/if}

		{#if (configuredRepeat ?? 1) > 1 || (repetition ?? 1) > 1}
			<span
				class="shrink-0 border border-purple-500 bg-purple-950 px-1.5 py-0.5 text-[0.55rem] font-black text-purple-100 uppercase"
			>
				{#if repetition !== null}
					repeat {repetition}{configuredRepeat && configuredRepeat > 1
						? ` / ${configuredRepeat}`
						: ''}
				{:else}
					repeat · {configuredRepeat}
				{/if}
			</span>
		{/if}
	</header>

	{#if node.type === 'Sequence' && visibleChildren.length > 0}
		<div class="grid gap-1.5 border-l border-sky-700/70 p-2">
			{#each visibleChildren as child (child.id)}
				<LiveSequenceNode node={child} {activeSteps} {visibleNodeIds} {showAll} />
			{/each}
		</div>
	{:else if node.type === 'ParallelGroup' && visibleChildren.length > 0}
		<div class="overflow-x-auto p-2">
			<div class="flex w-full min-w-0 items-stretch gap-2">
				{#each visibleChildren as child (child.id)}
					<div class="min-w-0 flex-1 basis-0 border-x border-fuchsia-800/60 p-1">
						<LiveSequenceNode node={child} {activeSteps} {visibleNodeIds} {showAll} />
					</div>
				{/each}
			</div>
			<div class="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-fuchsia-500">
				<span class="h-px bg-fuchsia-800"></span>
				<span class="text-[0.55rem] font-black tracking-[0.2em] uppercase">wait for all</span>
				<span class="h-px bg-fuchsia-800"></span>
			</div>
		</div>
	{/if}
</article>
