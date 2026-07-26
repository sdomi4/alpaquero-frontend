<script lang="ts">
	import { createDroppable } from '@dnd-kit/svelte';
	import type { DropTargetData } from '$lib/sequence-builder/types';

	type Props = {
		parentId: string;
		index: number;
		slotId: string;
		empty?: boolean;
		terminal?: boolean;
	};

	let { parentId, index, slotId, empty = false, terminal = false }: Props = $props();

	const droppable = createDroppable<DropTargetData>({
		get id() {
			return `container-slot:${parentId}:${slotId}`;
		},
		type: 'container-slot',
		accept: 'sequence-block',
		get data() {
			return { kind: 'container-slot', parentId, index } satisfies DropTargetData;
		}
	});
</script>

<div
	{@attach droppable.attach}
	data-drop-parent={parentId}
	data-drop-index={index}
	data-drop-slot={slotId}
	aria-label={terminal || empty ? 'Drop at sequence end' : 'Insert block here'}
	class="w-full border-dashed transition-[height,background-color,border-color] duration-100"
	class:h-3={!empty && !terminal && !droppable.isDropTarget}
	class:h-8={(empty || terminal) && !droppable.isDropTarget}
	class:h-10={droppable.isDropTarget}
	class:border={empty || terminal || droppable.isDropTarget}
	class:border-neutral-700={(empty || terminal) && !droppable.isDropTarget}
	class:border-[#80499c]={droppable.isDropTarget}
	class:bg-[#2b1735]={droppable.isDropTarget}
></div>
