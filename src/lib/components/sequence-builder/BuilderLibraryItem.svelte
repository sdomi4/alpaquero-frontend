<script lang="ts">
	import { createDraggable } from '@dnd-kit/svelte';
	import { untrack } from 'svelte';
	import type { DragSourceData, LibraryBlockType } from '$lib/sequence-builder/types';

	type Props = {
		blockType: LibraryBlockType;
		actionName?: string;
		label: string;
		description?: string;
		icon: string;
	};

	let { blockType, actionName, label, description, icon }: Props = $props();

	const initialBlockType = untrack(() => blockType);
	const initialActionName = untrack(() => actionName);
	const sourceData: Extract<DragSourceData, { kind: 'library-block' }> = {
		kind: 'library-block',
		blockType: initialBlockType,
		actionName: initialActionName
	};
	const draggable = createDraggable<DragSourceData>({
		id: `library:${initialBlockType}:${initialActionName ?? 'structural'}`,
		type: 'sequence-block',
		data: sourceData
	});
</script>

<div
	{@attach draggable.attach}
	{@attach draggable.attachHandle}
	aria-label={`Drag ${label}`}
	title={`Drag ${label}`}
	class="grid min-w-0 cursor-grab touch-none grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 border bg-neutral-950 p-1.5 transition-opacity select-none active:cursor-grabbing"
	class:border-emerald-700={blockType === 'action'}
	class:border-sky-700={blockType === 'sequence'}
	class:border-fuchsia-700={blockType === 'parallel'}
	class:border-amber-700={blockType === 'pause'}
	class:opacity-40={draggable.isDragging}
>
	<div
		aria-hidden="true"
		class="grid size-8 place-items-center border font-mono text-sm font-black"
		class:border-emerald-600={blockType === 'action'}
		class:bg-emerald-950={blockType === 'action'}
		class:text-emerald-200={blockType === 'action'}
		class:border-sky-600={blockType === 'sequence'}
		class:bg-sky-950={blockType === 'sequence'}
		class:text-sky-200={blockType === 'sequence'}
		class:border-fuchsia-600={blockType === 'parallel'}
		class:bg-fuchsia-950={blockType === 'parallel'}
		class:text-fuchsia-200={blockType === 'parallel'}
		class:border-amber-600={blockType === 'pause'}
		class:bg-amber-950={blockType === 'pause'}
		class:text-amber-200={blockType === 'pause'}
	>
		{icon}
	</div>

	<div class="min-w-0">
		<p class="text-xs leading-none font-black uppercase">{label}</p>
		{#if description}
			<p class="mt-1 text-[0.6rem] leading-tight text-neutral-500">{description}</p>
		{/if}
	</div>
</div>
