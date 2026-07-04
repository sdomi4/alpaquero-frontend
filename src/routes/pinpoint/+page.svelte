<script lang="ts">
	import { onDestroy } from 'svelte';
	import logo from '$lib/assets/Arriero_Logo_Mono_Clear.svg';
	import {
		buildPinpointPayload,
		DEFAULT_PINPOINT_CATALOG,
		DEFAULT_PINPOINT_CATALOG_PATH,
		DEFAULT_PINPOINT_GLOB,
		runPinpointSolver
	} from '$lib/api/pinpointRequests.js';

	let form = $state({
		folderPath: '',
		glob: DEFAULT_PINPOINT_GLOB,
		catalog: String(DEFAULT_PINPOINT_CATALOG),
		catalogPath: DEFAULT_PINPOINT_CATALOG_PATH,
		ra: '',
		dec: '',
		arcsecPerPixel: ''
	});

	let pending = $state(false);
	let elapsedSeconds = $state(0);
	let result = $state<unknown | null>(null);
	let error = $state<string | null>(null);
	let timer: ReturnType<typeof setInterval> | null = null;
	let startedAt = 0;

	const resultText = $derived(result === null ? '' : JSON.stringify(result, null, 2));
	const elapsedLabel = $derived(formatElapsed(elapsedSeconds));

	function startTimer() {
		stopTimer();
		startedAt = Date.now();
		elapsedSeconds = 0;
		timer = setInterval(() => {
			elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
		}, 1000);
	}

	function stopTimer() {
		if (!timer) return;
		clearInterval(timer);
		timer = null;
	}

	function formatElapsed(seconds: number) {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const remainder = seconds % 60;

		if (hours > 0) {
			return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(remainder).padStart(2, '0')}s`;
		}

		return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
	}

	async function handleSubmit() {
		if (pending) return;

		pending = true;
		error = null;
		result = null;
		startTimer();

		try {
			const payload = buildPinpointPayload(form);
			result = await runPinpointSolver(payload);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Pinpoint solver failed';
		} finally {
			pending = false;
			stopTimer();
		}
	}

	onDestroy(() => {
		stopTimer();
	});
</script>

<svelte:head>
	<title>Pinpoint Solver | Alpaquero</title>
</svelte:head>

<main class="min-h-screen bg-neutral-950 p-2 text-neutral-100">
	<div class="mx-auto grid min-h-[calc(100vh-1rem)] max-w-5xl grid-rows-[auto_minmax(0,1fr)] gap-2">
		<header
			class="grid gap-3 border-2 border-neutral-700 bg-neutral-900 p-2 text-neutral-100 shadow-[4px_4px_0_#80499c] md:grid-cols-[1fr_auto] md:items-center"
		>
			<div class="flex min-w-0 items-center gap-3">
				<img src={logo} alt="" class="h-10 w-10 object-contain" />
				<div class="min-w-0">
					<h1
						class="text-3xl leading-none font-semibold uppercase md:text-4xl"
						style:font-family="'Saira Extra Condensed', sans-serif"
					>
						Pinpoint
					</h1>
					<p class="truncate font-mono text-xs text-neutral-400 uppercase">
						Plate solver folder run
					</p>
				</div>
			</div>

			<a
				href="/"
				class="w-fit border border-[#80499c] bg-[#211428] px-3 py-1.5 font-mono text-xs text-purple-100 uppercase transition-transform hover:bg-[#2f1c39] active:translate-x-[1px] active:translate-y-[1px]"
			>
				Main
			</a>
		</header>

		<section class="grid min-h-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void handleSubmit();
				}}
				class="flex min-h-0 flex-col gap-3 border-2 border-neutral-700 bg-neutral-900 p-3 shadow-[4px_4px_0_#80499c]"
			>
				<div class="border-b-2 border-neutral-700 pb-2">
					<h2 class="text-lg leading-none font-black uppercase">Solver Request</h2>
				</div>

				<div class="grid gap-3 md:grid-cols-2">
					<label class="grid gap-1 md:col-span-2">
						<span class="font-mono text-[0.7rem] font-black text-purple-200 uppercase">
							Folder path
						</span>
						<input
							bind:value={form.folderPath}
							required
							placeholder="C:\data\captures"
							class="border-2 border-neutral-700 bg-neutral-950 px-2 py-2 font-mono text-sm text-neutral-100 outline-none focus:border-[#80499c]"
						/>
					</label>

					<label class="grid gap-1">
						<span class="font-mono text-[0.7rem] font-black text-purple-200 uppercase">File Filter (Glob)</span>
						<input
							bind:value={form.glob}
							placeholder={DEFAULT_PINPOINT_GLOB}
							class="border-2 border-neutral-700 bg-neutral-950 px-2 py-2 font-mono text-sm text-neutral-100 outline-none focus:border-[#80499c]"
						/>
					</label>

					<label class="grid gap-1">
						<span class="font-mono text-[0.7rem] font-black text-purple-200 uppercase">
							Catalog
						</span>
						<input
							bind:value={form.catalog}
							type="number"
							step="1"
							required
							class="border-2 border-neutral-700 bg-neutral-950 px-2 py-2 font-mono text-sm text-neutral-100 outline-none focus:border-[#80499c]"
						/>
					</label>

					<label class="grid gap-1 md:col-span-2">
						<span class="font-mono text-[0.7rem] font-black text-purple-200 uppercase">
							Catalog path
						</span>
						<input
							bind:value={form.catalogPath}
							placeholder={DEFAULT_PINPOINT_CATALOG_PATH}
							class="border-2 border-neutral-700 bg-neutral-950 px-2 py-2 font-mono text-sm text-neutral-100 outline-none focus:border-[#80499c]"
						/>
					</label>

					<label class="grid gap-1">
						<span class="font-mono text-[0.7rem] font-black text-purple-200 uppercase">RA</span>
						<input
							bind:value={form.ra}
							type="number"
							step="any"
							required
							class="border-2 border-neutral-700 bg-neutral-950 px-2 py-2 font-mono text-sm text-neutral-100 outline-none focus:border-[#80499c]"
						/>
					</label>

					<label class="grid gap-1">
						<span class="font-mono text-[0.7rem] font-black text-purple-200 uppercase">Dec</span>
						<input
							bind:value={form.dec}
							type="number"
							step="any"
							required
							class="border-2 border-neutral-700 bg-neutral-950 px-2 py-2 font-mono text-sm text-neutral-100 outline-none focus:border-[#80499c]"
						/>
					</label>

					<label class="grid gap-1 md:col-span-2">
						<span class="font-mono text-[0.7rem] font-black text-purple-200 uppercase">
							Arcsec per pixel
						</span>
						<input
							bind:value={form.arcsecPerPixel}
							type="number"
							step="any"
							placeholder="Optional (Default 1)"
							class="border-2 border-neutral-700 bg-neutral-950 px-2 py-2 font-mono text-sm text-neutral-100 outline-none focus:border-[#80499c]"
						/>
					</label>
				</div>

				<div class="mt-auto flex flex-wrap items-center gap-2 border-t-2 border-neutral-700 pt-3">
					<button
						type="submit"
						disabled={pending}
						class="border-2 border-[#80499c] bg-[#211428] px-4 py-2 font-mono text-sm font-black text-purple-100 uppercase shadow-[3px_3px_0_#80499c] transition-transform hover:bg-[#2f1c39] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-wait disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
					>
						{pending ? 'Running' : 'Run Pinpoint'}
					</button>

					{#if pending}
						<span class="font-mono text-xs text-neutral-400 uppercase">
							Elapsed {elapsedLabel}
						</span>
					{/if}
				</div>
			</form>

			<aside
				class="flex min-h-[18rem] flex-col border-2 border-neutral-700 bg-neutral-900 p-3 shadow-[4px_4px_0_#80499c]"
			>
				<div class="border-b-2 border-neutral-700 pb-2">
					<h2 class="text-lg leading-none font-black uppercase">Status</h2>
				</div>

				{#if pending}
					<div class="mt-3 grid gap-3">
						<div class="h-3 overflow-hidden border border-[#80499c] bg-neutral-950">
							<div class="pinpoint-progress h-full w-1/2 bg-[#80499c]"></div>
						</div>
						<p class="font-mono text-sm text-purple-100 uppercase">
							Solver still running. Elapsed {elapsedLabel}
						</p>
					</div>
				{:else if error}
					<div class="mt-3 border-2 border-red-500 bg-red-950 p-2 text-red-100">
						<p class="font-mono text-sm font-black uppercase">Request failed</p>
						<p class="mt-1 font-mono text-xs break-words">{error}</p>
					</div>
				{:else if result !== null}
					<pre
						class="mt-3 min-h-0 flex-1 overflow-auto border border-neutral-700 bg-neutral-950 p-2 font-mono text-xs text-neutral-100">{resultText}</pre>
				{:else}
					<p
						class="mt-3 border border-dashed border-neutral-700 p-2 font-mono text-xs text-neutral-500"
					>
						No pinpoint run submitted yet.
					</p>
				{/if}
			</aside>
		</section>
	</div>
</main>

<style>
	.pinpoint-progress {
		animation: pinpoint-runner 1.1s ease-in-out infinite alternate;
	}

	@keyframes pinpoint-runner {
		from {
			transform: translateX(-100%);
		}

		to {
			transform: translateX(200%);
		}
	}
</style>
