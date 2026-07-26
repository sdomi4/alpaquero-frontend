<script lang="ts">
	import { createDroppable } from '@dnd-kit/svelte';
	import type { DropTargetData } from '$lib/sequence-builder/types';

	type Props = {
		parallelId: string;
		index: number;
		empty?: boolean;
	};

	let { parallelId, index, empty = false }: Props = $props();

	const droppable = createDroppable<DropTargetData>({
		get id() {
			return `parallel-new-branch:${parallelId}:end`;
		},
		type: 'parallel-new-branch',
		accept: 'sequence-block',
		get data() {
			return {
				kind: 'parallel-new-branch',
				parallelId,
				index
			} satisfies DropTargetData;
		}
	});
</script>

<div
	{@attach droppable.attach}
	data-parallel-new-branch={parallelId}
	data-parallel-branch-index={index}
	aria-label={empty
		? 'Drop to create the first parallel branch'
		: 'Drop to create a new parallel branch'}
	class="min-h-28 w-20 shrink-0 border border-dashed transition-colors"
	class:border-fuchsia-400={droppable.isDropTarget}
	class:bg-[#4b1c5b]={droppable.isDropTarget}
	class:border-fuchsia-950={!droppable.isDropTarget}
	class:bg-[#180d20]={!droppable.isDropTarget}
></div>
