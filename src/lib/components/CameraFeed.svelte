<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_WS_BASE } from '$env/static/public';
	import { buildWebrtcFeedUrl } from '$lib/cameraFeeds.js';
	import {
		buildFullPreviewImagePath,
		normalizeCapturePreviews
	} from '$lib/previewImages.js';

	type CameraFeed = {
		id: string;
		name: string;
		path: string;
	};

	type CapturePreview = {
		name: string;
		timestamp: string;
		src: string;
	};

	type Props = {
		feeds: CameraFeed[];
	};

	let { feeds }: Props = $props();

	const PREVIEWS_TAB_ID = '__capture_previews__';

	let activeId = $state('');
	let currentHref = $state('');
	let previews = $state<CapturePreview[]>([]);
	let selectedPreview = $state<CapturePreview | null>(null);
	let fullPreviewError = $state('');

	const showingPreviews = $derived(activeId === PREVIEWS_TAB_ID);
	const activeFeed = $derived(
		showingPreviews ? null : (feeds.find((feed) => feed.id === activeId) ?? feeds[0] ?? null)
	);
	const activeUrl = $derived(
		!showingPreviews && activeFeed && currentHref
			? buildWebrtcFeedUrl(activeFeed.path, currentHref)
			: ''
	);
	const selectedPreviewUrl = $derived(
		selectedPreview ? buildFullPreviewImagePath(selectedPreview.name) : ''
	);

	$effect(() => {
		if (activeId !== PREVIEWS_TAB_ID && !feeds.some((feed) => feed.id === activeId)) {
			activeId = feeds[0]?.id ?? PREVIEWS_TAB_ID;
		}
	});

	onMount(() => {
		currentHref = window.location.href;
		const previewWs = new WebSocket(`${PUBLIC_WS_BASE}/ws/previews`);

		previewWs.onmessage = (event) => {
			try {
				previews = normalizeCapturePreviews(JSON.parse(event.data));
			} catch (error) {
				console.error('Invalid preview websocket payload:', error);
			}
		};

		return () => {
			previewWs.close();
		};
	});

	function openPreview(preview: CapturePreview) {
		fullPreviewError = '';
		selectedPreview = preview;
	}

	function closePreview() {
		selectedPreview = null;
		fullPreviewError = '';
	}
</script>

<section
	class="flex h-full min-h-0 flex-col border-2 border-neutral-700 bg-neutral-900 p-2 shadow-[4px_4px_0_#80499c]"
>
	<div class="mb-2 flex items-center justify-between gap-3 border-b-2 border-neutral-700 pb-2">
		<h2 class="text-lg leading-none font-black uppercase">Camera feeds</h2>

		<div class="flex flex-wrap justify-end gap-1">
			{#if feeds.length > 0}
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
			{/if}

			<button
				type="button"
				onclick={() => {
					activeId = PREVIEWS_TAB_ID;
				}}
				class="border px-2 py-1 font-mono text-[0.65rem] leading-none font-black uppercase transition-transform active:translate-x-[1px] active:translate-y-[1px]"
				class:border-[#80499c]={showingPreviews}
				class:bg-[#80499c]={showingPreviews}
				class:text-neutral-50={showingPreviews}
				class:border-neutral-600={!showingPreviews}
				class:bg-neutral-950={!showingPreviews}
				class:text-neutral-300={!showingPreviews}
				aria-pressed={showingPreviews}
			>
				Previews
			</button>
		</div>
	</div>

	{#if showingPreviews}
		<div class="min-h-0 flex-1 overflow-hidden border-2 border-neutral-700 bg-neutral-950">
			<div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 p-2">
				<div class="flex justify-end font-mono text-[0.65rem] text-neutral-500 uppercase">
					{previews.length} / 3 previews
				</div>

				{#if previews.length === 0}
					<div class="grid h-full place-items-center p-4 text-center font-mono text-sm text-neutral-500">
						No capture previews received.
					</div>
				{:else}
					<div class="grid min-h-0 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
						{#each previews as preview (preview.name)}
							<article class="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] border border-neutral-700 bg-neutral-900">
								<div class="min-h-0 bg-neutral-950">
									<img
										src={preview.src}
										alt={`Preview ${preview.name}`}
										class="h-full min-h-32 w-full object-contain"
										loading="lazy"
									/>
								</div>

								<div class="grid gap-2 border-t border-neutral-700 p-2">
									<div class="min-w-0 font-mono text-[0.65rem] uppercase">
										<p class="truncate font-black text-neutral-100">{preview.name}</p>
										{#if preview.timestamp}
											<p class="truncate text-neutral-500">{preview.timestamp}</p>
										{/if}
									</div>

									<button
										type="button"
										onclick={() => openPreview(preview)}
										class="border border-[#80499c] bg-[#211428] px-2 py-1 font-mono text-[0.65rem] font-black text-purple-100 uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-[#2b1934] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
									>
										Enlarge
									</button>
								</div>
							</article>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{:else if feeds.length === 0}
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

{#if selectedPreview}
	<div class="fixed inset-0 z-50 grid place-items-center bg-neutral-950/90 p-3">
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default border-0 bg-transparent p-0"
			aria-label="Close full size preview"
			onclick={closePreview}
		></button>

		<div
			class="relative z-10 grid max-h-full w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] border-2 border-neutral-700 bg-neutral-900 shadow-[4px_4px_0_#80499c]"
			role="dialog"
			aria-modal="true"
			aria-label={`Full size preview ${selectedPreview.name}`}
			tabindex="-1"
		>
			<div class="flex items-center justify-between gap-3 border-b-2 border-neutral-700 p-2">
				<div class="min-w-0 font-mono text-xs uppercase">
					<p class="truncate font-black text-neutral-100">{selectedPreview.name}</p>
					{#if selectedPreview.timestamp}
						<p class="truncate text-neutral-500">{selectedPreview.timestamp}</p>
					{/if}
				</div>

				<button
					type="button"
					onclick={closePreview}
					class="grid size-9 place-items-center border border-neutral-600 bg-neutral-950 font-mono text-sm font-black text-neutral-200 uppercase transition-transform hover:bg-neutral-800 active:translate-x-[1px] active:translate-y-[1px]"
					aria-label="Close full size preview"
				>
					X
				</button>
			</div>

			<div class="min-h-0 bg-neutral-950 p-2">
				{#if fullPreviewError}
					<div class="grid h-full place-items-center p-4 text-center font-mono text-sm text-red-200">
						{fullPreviewError}
					</div>
				{:else}
					{#key selectedPreviewUrl}
						<img
							src={selectedPreviewUrl}
							alt={`Full size preview ${selectedPreview.name}`}
							class="h-full max-h-[82vh] w-full object-contain"
							onerror={() => {
								fullPreviewError = 'Full size image unavailable.';
							}}
						/>
					{/key}
				{/if}
			</div>
		</div>
	</div>
{/if}
