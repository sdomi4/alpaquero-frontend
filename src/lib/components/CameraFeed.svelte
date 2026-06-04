<script lang="ts">
	import { onMount } from 'svelte';
	import { buildWebrtcFeedUrl } from '$lib/cameraFeeds.js';

	type CameraFeed = {
		id: string;
		name: string;
		path: string;
	};

	type Props = {
		feeds: CameraFeed[];
	};

	let { feeds }: Props = $props();

	let activeId = $state('');
	let currentHref = $state('');

	const activeFeed = $derived(feeds.find((feed) => feed.id === activeId) ?? feeds[0] ?? null);
	const activeUrl = $derived(
		activeFeed && currentHref ? buildWebrtcFeedUrl(activeFeed.path, currentHref) : ''
	);

	$effect(() => {
		if (!feeds.some((feed) => feed.id === activeId)) {
			activeId = feeds[0]?.id ?? '';
		}
	});

	onMount(() => {
		currentHref = window.location.href;
	});
</script>

<section
	class="flex h-full min-h-0 flex-col border-2 border-neutral-700 bg-neutral-900 p-2 shadow-[4px_4px_0_#80499c]"
>
	<div class="mb-2 flex items-center justify-between gap-3 border-b-2 border-neutral-700 pb-2">
		<h2 class="text-lg leading-none font-black uppercase">Camera feeds</h2>

		{#if feeds.length > 0}
			<div class="flex flex-wrap justify-end gap-1">
				{#each feeds as feed (feed.id)}
					<button
						type="button"
						onclick={() => {
							activeId = feed.id;
						}}
						class="border px-2 py-1 font-mono text-[0.65rem] leading-none font-black uppercase transition-transform active:translate-x-[1px] active:translate-y-[1px]"
						class:border-[#80499c]={feed.id === activeFeed?.id}
						class:bg-[#80499c]={feed.id === activeFeed?.id}
						class:text-neutral-50={feed.id === activeFeed?.id}
						class:border-neutral-600={feed.id !== activeFeed?.id}
						class:bg-neutral-950={feed.id !== activeFeed?.id}
						class:text-neutral-300={feed.id !== activeFeed?.id}
						aria-pressed={feed.id === activeFeed?.id}
					>
						{feed.name}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if feeds.length === 0}
		<p class="border-2 border-dashed border-neutral-700 p-3 font-mono text-sm text-neutral-500">
			No WebRTC camera feeds configured.
		</p>
	{:else}
		<div class="min-h-0 flex-1 overflow-hidden border-2 border-neutral-700 bg-neutral-950">
			<div class="h-full w-full">
				{#if activeUrl}
					{#key activeUrl}
						<iframe
							title={activeFeed ? `${activeFeed.name} WebRTC feed` : 'WebRTC feed'}
							src={activeUrl}
							class="h-full w-full bg-neutral-950"
							allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
							loading="lazy"
						></iframe>
					{/key}
				{:else}
					<div
						class="grid h-full place-items-center p-4 text-center font-mono text-sm text-neutral-500"
					>
						Preparing feed...
					</div>
				{/if}
			</div>
		</div>
	{/if}
</section>
