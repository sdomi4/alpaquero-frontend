<script lang="ts">
	import { onMount } from 'svelte';
	import { buildSameHostFeedUrl } from '$lib/cameraFeeds.js';

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
		activeFeed && currentHref ? buildSameHostFeedUrl(activeFeed.path, currentHref) : ''
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

<section class="border-4 border-neutral-100 bg-neutral-900 p-4 shadow-[8px_8px_0_#22c55e]">
	<div class="mb-3 flex items-end justify-between gap-3 border-b-4 border-neutral-100 pb-2">
		<div>
			<p class="font-mono text-xs text-neutral-400 uppercase">same-host webrtc</p>
			<h2 class="text-2xl font-black uppercase">Cameras</h2>
		</div>

		<span class="border-2 border-neutral-100 px-2 py-1 font-mono text-xs uppercase">
			{feeds.length} feeds
		</span>
	</div>

	{#if feeds.length === 0}
		<p class="border-2 border-dashed border-neutral-700 p-3 font-mono text-sm text-neutral-500">
			No WebRTC camera feeds configured.
		</p>
	{:else}
		<div class="mb-3 flex flex-wrap gap-2">
			{#each feeds as feed (feed.id)}
				<button
					type="button"
					onclick={() => {
						activeId = feed.id;
					}}
					class="border-2 px-3 py-1 font-mono text-xs font-black uppercase transition-transform active:translate-x-[2px] active:translate-y-[2px]"
					class:border-green-300={feed.id === activeFeed?.id}
					class:bg-green-400={feed.id === activeFeed?.id}
					class:text-neutral-950={feed.id === activeFeed?.id}
					class:border-neutral-500={feed.id !== activeFeed?.id}
					class:bg-neutral-950={feed.id !== activeFeed?.id}
					class:text-neutral-200={feed.id !== activeFeed?.id}
					aria-pressed={feed.id === activeFeed?.id}
				>
					{feed.name}
				</button>
			{/each}
		</div>

		<div class="overflow-hidden border-4 border-neutral-100 bg-neutral-950">
			<div class="aspect-video w-full">
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
					<div class="grid h-full place-items-center p-4 text-center font-mono text-sm text-neutral-500">
						Preparing feed...
					</div>
				{/if}
			</div>
		</div>

		{#if activeFeed}
			<div class="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-neutral-400">
				<span>{activeFeed.path}</span>

				{#if activeUrl}
					<a
						href={activeUrl}
						target="_blank"
						rel="noreferrer"
						class="border-2 border-neutral-500 px-2 py-1 font-black text-neutral-200 uppercase"
					>
						open
					</a>
				{/if}
			</div>
		{/if}
	{/if}
</section>
