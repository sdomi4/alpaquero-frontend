<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/Arriero_Logo_Mono_Clear.svg';
	import {
		buildPinpointPayload,
		DEFAULT_PINPOINT_CATALOG,
		DEFAULT_PINPOINT_CATALOG_PATH,
		DEFAULT_PINPOINT_GLOB,
		runPinpointSolver
	} from '$lib/api/pinpointRequests.js';

	type PinpointJobStatusName =
		| 'queued'
		| 'running'
		| 'completed'
		| 'completed_with_errors'
		| 'failed';

	type PinpointSolveResult = {
		ra_hours: number;
		dec_degrees: number;
		position_angle: number;
		arcsec_per_pixel_x: number;
		arcsec_per_pixel_y: number;
		stars_detected: number | null;
	};

	type PinpointJob = {
		job_id: string;
		status: PinpointJobStatusName;
		status_url?: string;
		total_files: number;
		processed_files?: number;
		successful_files?: number;
		failed_files?: number;
		remaining_files?: number;
		current_file?: string | null;
		average_solve_time_seconds?: number | null;
		estimated_remaining_seconds?: number | null;
		estimated_completion_at?: string | null;
		results?: Array<{ file: string; result: PinpointSolveResult }>;
		errors?: Array<{ file: string; error: string }>;
		error?: string | null;
	};

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
	let job = $state<PinpointJob | null>(null);
	let error = $state<string | null>(null);
	let timer: ReturnType<typeof setInterval> | null = null;
	let requestController: AbortController | null = null;
	let startedAt = 0;

	const elapsedLabel = $derived(formatElapsed(elapsedSeconds));
	const processedFiles = $derived(job?.processed_files ?? 0);
	const progressPercent = $derived(
		job === null ? 0 : job.total_files === 0 ? 100 : (processedFiles / job.total_files) * 100
	);
	const statusLabel = $derived(job?.status.replaceAll('_', ' ') ?? '');
	const etaLabel = $derived(
		job?.estimated_remaining_seconds == null
			? null
			: formatElapsed(Math.max(0, Math.ceil(job.estimated_remaining_seconds)))
	);

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
		job = null;
		requestController = new AbortController();
		startTimer();

		try {
			const payload = buildPinpointPayload(form);
			job = (await runPinpointSolver(payload, {
				signal: requestController.signal,
				onUpdate: (update) => {
					job = update as PinpointJob;
				}
			})) as PinpointJob;
		} catch (err) {
			if (requestController.signal.aborted) return;
			error = err instanceof Error ? err.message : 'Pinpoint solver failed';
		} finally {
			pending = false;
			requestController = null;
			stopTimer();
		}
	}

	onDestroy(() => {
		requestController?.abort();
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
				href={resolve('/')}
				data-control
				class="w-fit border border-[#80499c] bg-[#211428] px-3 py-1.5 font-mono text-xs text-purple-100 uppercase hover:bg-[#2f1c39]"
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
						<span class="font-mono text-[0.7rem] font-black text-purple-200 uppercase"
							>File Filter (Glob)</span
						>
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
						class="min-w-36 border-2 border-[#80499c] bg-[#211428] px-4 py-2 font-mono text-sm font-black text-purple-100 uppercase shadow-[3px_3px_0_#80499c] hover:bg-[#2f1c39] disabled:cursor-wait disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600"
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

				{#if error}
					<div class="mt-3 border-2 border-red-500 bg-red-950 p-2 text-red-100">
						<p class="font-mono text-sm font-black uppercase">Request failed</p>
						<p class="mt-1 font-mono text-xs break-words">{error}</p>
					</div>
				{:else if job}
					<div class="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<span
								class="border border-[#80499c] bg-[#211428] px-2 py-1 font-mono text-xs font-black text-purple-100 uppercase"
							>
								{statusLabel}
							</span>
							<span class="font-mono text-[0.65rem] text-neutral-500">Job {job.job_id}</span>
						</div>

						<div class="grid gap-1">
							<div class="flex justify-between font-mono text-xs">
								<span>{processedFiles} / {job.total_files} files</span>
								<span>{Math.round(progressPercent)}%</span>
							</div>
							<div class="h-3 overflow-hidden border border-[#80499c] bg-neutral-950">
								<div
									class="h-full bg-[#80499c] transition-[width] duration-300"
									style:width={`${Math.min(100, Math.max(0, progressPercent))}%`}
								></div>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
							<div class="border border-neutral-700 bg-neutral-950 p-2">
								<p class="text-[0.6rem] text-neutral-500 uppercase">Succeeded</p>
								<p class="mt-1 text-sm font-black text-emerald-300">{job.successful_files ?? 0}</p>
							</div>
							<div class="border border-neutral-700 bg-neutral-950 p-2">
								<p class="text-[0.6rem] text-neutral-500 uppercase">Failed</p>
								<p class="mt-1 text-sm font-black text-red-300">{job.failed_files ?? 0}</p>
							</div>
							<div class="border border-neutral-700 bg-neutral-950 p-2">
								<p class="text-[0.6rem] text-neutral-500 uppercase">Remaining</p>
								<p class="mt-1 text-sm font-black">{job.remaining_files ?? job.total_files}</p>
							</div>
							<div class="border border-neutral-700 bg-neutral-950 p-2">
								<p class="text-[0.6rem] text-neutral-500 uppercase">ETA</p>
								<p class="mt-1 text-sm font-black">{etaLabel ?? '—'}</p>
							</div>
						</div>

						{#if pending}
							<div class="grid gap-1 font-mono text-xs">
								<p class="text-neutral-400">Elapsed {elapsedLabel}</p>
								{#if job.current_file}
									<p class="break-all text-purple-100">Processing {job.current_file}</p>
								{:else if job.status === 'queued'}
									<p class="text-neutral-400">Waiting for the Pinpoint worker.</p>
								{/if}
							</div>
						{/if}

						{#if job.status === 'failed'}
							<div class="border-2 border-red-500 bg-red-950 p-2 text-red-100">
								<p class="font-mono text-xs font-black uppercase">Job failed</p>
								<p class="mt-1 font-mono text-xs break-words">{job.error ?? 'Unknown job error'}</p>
							</div>
						{/if}

						{#if job.results?.length}
							<section class="grid gap-2">
								<h3 class="border-b border-neutral-700 pb-1 font-mono text-xs font-black uppercase">
									Results ({job.results.length})
								</h3>
								{#each job.results as solved (solved.file)}
									<div class="border border-neutral-700 bg-neutral-950 p-2 font-mono text-xs">
										<p class="font-black break-all text-purple-100">{solved.file}</p>
										<div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-neutral-300">
											<span>RA {solved.result.ra_hours}</span>
											<span>Dec {solved.result.dec_degrees}</span>
											<span>Angle {solved.result.position_angle}°</span>
											<span>Stars {solved.result.stars_detected ?? '—'}</span>
											<span>X {solved.result.arcsec_per_pixel_x}″/px</span>
											<span>Y {solved.result.arcsec_per_pixel_y}″/px</span>
										</div>
									</div>
								{/each}
							</section>
						{/if}

						{#if job.errors?.length}
							<section class="grid gap-2">
								<h3
									class="border-b border-red-900 pb-1 font-mono text-xs font-black text-red-200 uppercase"
								>
									File errors ({job.errors.length})
								</h3>
								{#each job.errors as fileError (fileError.file)}
									<div class="border border-red-900 bg-red-950 p-2 font-mono text-xs text-red-100">
										<p class="font-black break-all">{fileError.file}</p>
										<p class="mt-1 break-words">{fileError.error}</p>
									</div>
								{/each}
							</section>
						{/if}
					</div>
				{:else if pending}
					<div class="mt-3 grid gap-3">
						<div class="h-3 overflow-hidden border border-[#80499c] bg-neutral-950">
							<div class="pinpoint-progress h-full w-1/2 bg-[#80499c]"></div>
						</div>
						<p class="font-mono text-sm text-purple-100 uppercase">
							Scheduling job. Elapsed {elapsedLabel}
						</p>
					</div>
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
