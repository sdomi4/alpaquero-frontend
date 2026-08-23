<script lang="ts">
	import { createDraggable } from '@dnd-kit/svelte';
	import { untrack } from 'svelte';
	import BlockNode from './BlockNode.svelte';
	import DropZone from './DropZone.svelte';
	import ParallelBranchDropTarget from './ParallelBranchDropTarget.svelte';
	import ParallelNewBranchDropZone from './ParallelNewBranchDropZone.svelte';
	import { formatArgumentValue, nodeLabel, primaryArgumentFor } from '$lib/sequence-builder/model';
	import type {
		ActionDefinition,
		DragSourceData,
		SequenceBlock,
		ValidationIssue
	} from '$lib/sequence-builder/types';

	type Props = {
		node: SequenceBlock;
		selectedId: string | null;
		issues: ValidationIssue[];
		actions: ActionDefinition[];
		onSelect: (nodeId: string) => void;
		isRoot?: boolean;
	};

	let { node, selectedId, issues, actions, onSelect, isRoot = false }: Props = $props();

	const initialNodeId = untrack(() => node.id);
	const dragDisabled = untrack(() => isRoot);
	const draggable = createDraggable<DragSourceData>({
		id: `block:${initialNodeId}`,
		type: 'sequence-block',
		disabled: dragDisabled,
		data: { kind: 'existing-block', nodeId: initialNodeId }
	});

	const ownIssues = $derived(issues.filter((issue) => issue.nodeId === node.id));
	const hasError = $derived(ownIssues.some((issue) => issue.severity === 'error'));
	const primaryArgument = $derived(
		node.type === 'action' ? primaryArgumentFor(node, actions) : null
	);
	const hasLifecycleLogic = $derived(
		node.type !== 'pause' &&
			(node.delay !== undefined ||
				node.repeat !== undefined ||
				node.when !== undefined ||
				node.await !== undefined ||
				node.await_timeout !== undefined ||
				node.until !== undefined ||
				node.update === true ||
				(node.type === 'action' && Boolean(node.register)))
	);

	function eventBelongsToNode(event: Event) {
		const target = event.target;
		const currentTarget = event.currentTarget;
		if (!(target instanceof HTMLElement) || !(currentTarget instanceof HTMLElement)) return false;
		return target.closest('[data-block-id]') === currentTarget;
	}

	function selectFromBlock(event: MouseEvent) {
		if (eventBelongsToNode(event)) onSelect(node.id);
	}

	function selectFromKeyboard(event: KeyboardEvent) {
		if (
			eventBelongsToNode(event) &&
			event.target === event.currentTarget &&
			(event.key === 'Enter' || event.key === ' ')
		) {
			event.preventDefault();
			onSelect(node.id);
		}
	}
</script>

<div
	role="button"
	tabindex="0"
	aria-label={`Select ${nodeLabel(node)}`}
	aria-pressed={selectedId === node.id}
	onclick={selectFromBlock}
	onkeydown={selectFromKeyboard}
	class="min-w-0 cursor-pointer transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-neutral-100"
	class:opacity-40={draggable.isDragging}
	data-block-id={node.id}
	data-block-type={node.type}
>
	<div
		class="border"
		class:border-2={selectedId === node.id}
		class:border-red-400={hasError}
		class:border-emerald-700={node.type === 'action' && !hasError && selectedId !== node.id}
		class:border-sky-600={node.type === 'sequence' && !hasError && selectedId !== node.id}
		class:border-fuchsia-600={node.type === 'parallel' && !hasError && selectedId !== node.id}
		class:border-amber-600={node.type === 'pause' && !hasError && selectedId !== node.id}
		class:border-neutral-100={!hasError && selectedId === node.id}
		class:bg-[#15251a]={node.type === 'action'}
		class:bg-[#101d27]={node.type === 'sequence'}
		class:bg-[#271022]={node.type === 'parallel'}
		class:bg-[#2a2110]={node.type === 'pause'}
	>
		<header
			class="flex min-h-7 items-center gap-1.5 px-1.5 py-1"
			class:border-b={node.type !== 'action'}
			class:border-sky-700={node.type === 'sequence'}
			class:border-fuchsia-700={node.type === 'parallel'}
			class:border-amber-700={node.type === 'pause'}
		>
			{#if !isRoot}
				<button
					type="button"
					data-shadowless
					aria-label={`Drag ${nodeLabel(node)}`}
					title="Drag block"
					{@attach draggable.attach}
					{@attach draggable.attachHandle}
					class="cursor-grab px-1 text-xs text-neutral-500 hover:text-neutral-100 active:cursor-grabbing"
				>
					⠿
				</button>
			{:else}
				<span class="px-1 text-[0.65rem] text-neutral-600">◆</span>
			{/if}

			<button
				type="button"
				data-shadowless
				onclick={() => onSelect(node.id)}
				class="flex min-w-0 flex-1 items-center gap-2 text-left"
				aria-pressed={selectedId === node.id}
			>
				<span
					class="shrink-0 text-[0.6rem] font-black tracking-wider uppercase"
					class:text-emerald-300={node.type === 'action'}
					class:text-sky-300={node.type === 'sequence'}
					class:text-fuchsia-300={node.type === 'parallel'}
					class:text-amber-300={node.type === 'pause'}
				>
					{node.type}
				</span>
				<span class="min-w-0 truncate text-xs font-semibold text-neutral-100">
					{nodeLabel(node)}
				</span>
			</button>

			{#if ownIssues.length > 0}
				<span
					class="shrink-0 border px-1 py-0.5 text-[0.55rem] font-black uppercase"
					class:border-red-500={hasError}
					class:text-red-200={hasError}
					class:border-yellow-600={!hasError}
					class:text-yellow-200={!hasError}
					title={ownIssues.map((issue) => issue.message).join(' ')}
				>
					{hasError ? 'error' : 'warn'}
				</span>
			{/if}

			{#if primaryArgument}
				<span
					class="max-w-44 shrink-0 truncate border border-emerald-700 bg-emerald-950 px-1.5 py-0.5 text-[0.6rem] text-emerald-100"
					title={`${primaryArgument.name}: ${formatArgumentValue(primaryArgument.value)}`}
				>
					{primaryArgument.name}: {formatArgumentValue(primaryArgument.value)}
				</span>
			{/if}
		</header>

		{#if hasLifecycleLogic && node.type !== 'pause'}
			<div
				class="flex min-w-0 flex-wrap items-center gap-1 border-t border-neutral-700/70 px-2 py-1 text-[0.52rem] font-black uppercase"
			>
				{#if node.await}
					<span
						class="max-w-56 truncate border border-cyan-800 bg-cyan-950 px-1.5 py-0.5 text-cyan-200"
						title={`Await: ${node.await}`}
					>
						await · {node.await}
					</span>
				{/if}
				{#if node.await_timeout !== undefined}
					<span class="border border-cyan-900 px-1.5 py-0.5 text-cyan-300">
						timeout · {node.await_timeout}s
					</span>
				{/if}
				{#if node.delay !== undefined}
					<span class="border border-neutral-700 px-1.5 py-0.5 text-neutral-300">
						delay · {node.delay}s
					</span>
				{/if}
				{#if node.when}
					<span
						class="max-w-56 truncate border border-violet-800 bg-violet-950 px-1.5 py-0.5 text-violet-200"
						title={`When: ${node.when}`}
					>
						when · {node.when}
					</span>
				{/if}
				{#if node.repeat !== undefined}
					<span class="border border-neutral-700 px-1.5 py-0.5 text-neutral-300">
						repeat · {node.repeat}
					</span>
				{/if}
				{#if node.until}
					<span
						class="max-w-56 truncate border border-amber-800 bg-amber-950 px-1.5 py-0.5 text-amber-200"
						title={`Until: ${node.until}`}
					>
						until · {node.until}
					</span>
				{/if}
				{#if node.update}
					<span class="border border-sky-800 bg-sky-950 px-1.5 py-0.5 text-sky-200"> update </span>
				{/if}
				{#if node.type === 'action' && node.register}
					<span class="border border-emerald-800 bg-emerald-950 px-1.5 py-0.5 text-emerald-200">
						register · {node.register}
					</span>
				{/if}
			</div>
		{/if}

		{#if node.type === 'sequence'}
			<div class="border-l border-sky-700/70 p-2">
				{#each node.children as child, index (child.id)}
					<DropZone parentId={node.id} {index} slotId={`before:${child.id}`} />
					<BlockNode node={child} {selectedId} {issues} {actions} {onSelect} />
				{/each}
				<DropZone
					parentId={node.id}
					index={node.children.length}
					slotId="end"
					empty={node.children.length === 0}
					terminal={node.children.length > 0}
				/>
			</div>
		{:else if node.type === 'parallel'}
			<div class="overflow-x-auto p-2">
				<div class="flex w-full min-w-0 items-stretch gap-2">
					{#each node.children as child, index (child.id)}
						<ParallelBranchDropTarget parallelId={node.id} branchId={child.id} {index}>
							<BlockNode node={child} {selectedId} {issues} {actions} {onSelect} />
						</ParallelBranchDropTarget>
					{/each}
					<ParallelNewBranchDropZone
						parallelId={node.id}
						index={node.children.length}
						empty={node.children.length === 0}
					/>
				</div>
				<div class="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-fuchsia-500">
					<span class="h-px bg-fuchsia-800"></span>
					<span class="text-[0.55rem] font-black tracking-[0.2em] uppercase">wait for all</span>
					<span class="h-px bg-fuchsia-800"></span>
				</div>
			</div>
		{:else if node.type === 'pause'}
			<div class="border-t border-amber-800/70 px-3 py-2 text-[0.65rem] text-amber-100">
				{node.reason || 'The shared sequence context waits for an external resume.'}
			</div>
		{/if}
	</div>
</div>
