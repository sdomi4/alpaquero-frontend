<script lang="ts">
	import { createDroppable } from '@dnd-kit/svelte';
	import { type Snippet } from 'svelte';
	import type { DropTargetData } from '$lib/sequence-builder/types';

	type Props = {
		parallelId: string;
		branchId: string;
		index: number;
		children: Snippet;
	};

	let { parallelId, branchId, index, children }: Props = $props();

	const droppable = createDroppable<DropTargetData>({
		get id() {
			return `parallel-branch:${parallelId}:${branchId}`;
		},
		type: 'parallel-branch',
		accept: 'sequence-block',
		get data() {
			return {
				kind: 'parallel-branch',
				parallelId,
				branchId
			} satisfies DropTargetData;
		}
	});
</script>

<div
	{@attach droppable.attach}
	data-parallel-id={parallelId}
	data-parallel-branch-id={branchId}
	data-parallel-branch-index={index}
	class="relative flex min-h-28 min-w-0 flex-1 basis-0 flex-col border border-transparent transition-colors"
	class:border-fuchsia-400={droppable.isDropTarget}
	class:bg-fuchsia-950={droppable.isDropTarget}
>
	<div class="min-h-0 flex-1">
		{@render children()}
	</div>
	<div
		aria-label="Drop to append to this parallel branch"
		class="pointer-events-none mt-1 min-h-4 border border-dashed transition-colors"
		class:border-fuchsia-500={droppable.isDropTarget}
		class:bg-fuchsia-900={droppable.isDropTarget}
		class:border-fuchsia-900={!droppable.isDropTarget}
	></div>
</div>
