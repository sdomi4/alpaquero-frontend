<script lang="ts">
	import {
		abortSequence,
		listSequences,
		pauseSequence,
		resumeSequence,
		runSequence,
		uploadSequence
	} from '$lib/api/observatory';

	type ActiveSequence = {
		context_id: string;
		sequence_name: string;
		status: string;
	};

	type Props = {
		availableSequences: unknown;
		activeSequences: Record<string, ActiveSequence>;
	};

	let { availableSequences, activeSequences }: Props = $props();

	let localSequences = $state<string[]>([]);

	$effect(() => {
		localSequences = normalizeSequences(availableSequences);
	});
	let pending = $state<string | null>(null);
	let error = $state<string | null>(null);
	let uploadResult = $state<string | null>(null);
	let selectedFile = $state<File | null>(null);
	let uploadDialog = $state<HTMLDialogElement | null>(null);

	const activeList = $derived(Object.values(activeSequences ?? {}));

	function normalizeSequences(raw: unknown): string[] {
		if (Array.isArray(raw)) {
			return raw.map(String);
		}

		if (raw && typeof raw === 'object' && 'sequences' in raw) {
			const sequences = (raw as { sequences?: unknown }).sequences;

			if (Array.isArray(sequences)) {
				return sequences.map(String);
			}

			return [];
		}

		return [];
	}

	async function refreshSequences() {
		localSequences = normalizeSequences(await listSequences());
	}

	async function start(sequence: string) {
		pending = `start:${sequence}`;
		error = null;

		try {
			await runSequence(sequence);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to start sequence';
		} finally {
			pending = null;
		}
	}

	async function togglePause(sequence: ActiveSequence) {
		const isPaused = sequence.status === 'paused';
		pending = `${isPaused ? 'resume' : 'pause'}:${sequence.context_id}`;
		error = null;

		try {
			if (isPaused) {
				await resumeSequence(sequence.context_id);
			} else {
				await pauseSequence(sequence.context_id);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update sequence';
		} finally {
			pending = null;
		}
	}

	async function abort(sequence: ActiveSequence) {
		pending = `abort:${sequence.context_id}`;
		error = null;

		try {
			await abortSequence(sequence.context_id);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to abort sequence';
		} finally {
			pending = null;
		}
	}

	async function submitUpload() {
		if (!selectedFile) return;

		pending = 'upload';
		error = null;
		uploadResult = null;

		try {
			await uploadSequence(selectedFile, false);
			uploadResult = `Uploaded ${selectedFile.name}`;
			selectedFile = null;
			await refreshSequences();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to upload sequence';
		} finally {
			pending = null;
		}
	}
</script>

<section
	class="flex h-full min-h-0 flex-col border-2 border-neutral-700 bg-neutral-900 p-2 shadow-[4px_4px_0_#80499c]"
>
	<div class="mb-1.5 flex items-center justify-between gap-3 border-b-2 border-neutral-700 pb-1.5">
		<h2 class="text-base leading-none font-black uppercase">Sequences</h2>

		<button
			type="button"
			onclick={() => uploadDialog?.showModal()}
			class="border border-[#80499c] bg-neutral-800 px-2 py-0.5 font-mono text-[0.65rem] font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
		>
			upload
		</button>
	</div>

	<div class="grid min-h-0 flex-1 gap-1.5 overflow-y-auto pr-1">
		<div>
			<h3 class="mb-1 font-mono text-xs font-black text-neutral-300 uppercase">Available</h3>

			{#if localSequences.length === 0}
				<p class="border border-dashed border-neutral-700 p-1.5 font-mono text-xs text-neutral-500">
					No sequences found.
				</p>
			{:else}
				<div class="grid gap-1">
					{#each localSequences as sequence (sequence)}
						<div
							class="flex items-center justify-between gap-2 border border-neutral-700 bg-neutral-950 p-1"
						>
							<span class="truncate font-mono text-xs">{sequence}</span>

							<button
								type="button"
								disabled={pending === `start:${sequence}`}
								onclick={() => start(sequence)}
								class="border border-neutral-500 bg-neutral-800 px-2 py-0.5 font-mono text-[0.65rem] font-black uppercase shadow-[2px_2px_0_#80499c] hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-wait disabled:text-neutral-500 disabled:shadow-none"
							>
								{pending === `start:${sequence}` ? 'starting' : 'start'}
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div>
			<h3 class="mb-1 font-mono text-xs font-black text-neutral-300 uppercase">Running</h3>

			{#if activeList.length === 0}
				<p class="border border-dashed border-neutral-700 p-1.5 font-mono text-xs text-neutral-500">
					No active sequences.
				</p>
			{:else}
				<div class="grid gap-1">
					{#each activeList as sequence (sequence.context_id)}
						<div class="border border-neutral-700 bg-neutral-950 p-1">
							<div class="mb-1 flex items-start justify-between gap-2">
								<div>
									<p class="font-mono text-xs font-black uppercase">
										{sequence.sequence_name}
									</p>
								</div>

								<span
									class="border border-neutral-500 px-2 py-0.5 font-mono text-[0.65rem] uppercase"
								>
									{sequence.status}
								</span>
							</div>

							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									onclick={() => togglePause(sequence)}
									disabled={pending?.endsWith(sequence.context_id)}
									class="border border-neutral-500 bg-neutral-800 px-2 py-0.5 font-mono text-[0.65rem] font-black uppercase shadow-[2px_2px_0_#80499c] hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-wait disabled:text-neutral-500 disabled:shadow-none"
								>
									{sequence.status === 'paused' ? 'resume' : 'pause'}
								</button>

								<button
									type="button"
									onclick={() => abort(sequence)}
									disabled={pending?.endsWith(sequence.context_id)}
									class="border border-red-400 bg-red-950 px-2 py-0.5 font-mono text-[0.65rem] font-black text-red-100 uppercase shadow-[2px_2px_0_#80499c] hover:bg-red-900 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-wait disabled:text-neutral-500 disabled:shadow-none"
								>
									abort
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		{#if error}
			<p class="border-2 border-red-500 bg-red-950 p-2 font-mono text-sm text-red-100">
				{error}
			</p>
		{/if}

		{#if uploadResult}
			<p class="border-2 border-neutral-500 bg-neutral-950 p-2 font-mono text-sm text-neutral-300">
				{uploadResult}
			</p>
		{/if}
	</div>
</section>

<dialog
	bind:this={uploadDialog}
	class="w-[min(32rem,calc(100vw-2rem))] border-2 border-[#80499c] bg-neutral-950 p-0 text-neutral-100 shadow-[4px_4px_0_#80499c] backdrop:bg-black/80"
>
	<form method="dialog" class="border-b-2 border-neutral-700 bg-neutral-900 p-3">
		<div class="flex items-start justify-between gap-4">
			<div>
				<h2 class="text-lg font-black uppercase">Upload sequence</h2>
			</div>

			<button
				type="submit"
				class="border-2 border-neutral-100 px-2 py-1 font-mono text-xs font-black uppercase"
			>
				close
			</button>
		</div>
	</form>

	<div class="grid gap-3 p-3">
		<input
			type="file"
			accept=".yaml,.yml,text/yaml,application/x-yaml"
			onchange={(event) => {
				const input = event.currentTarget;
				selectedFile = input.files?.[0] ?? null;
			}}
			class="w-full border border-neutral-600 bg-neutral-900 p-2 font-mono text-sm"
		/>

		<button
			type="button"
			disabled={!selectedFile || pending === 'upload'}
			onclick={submitUpload}
			class="border border-[#80499c] bg-neutral-800 px-3 py-2 font-mono text-xs font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
		>
			{pending === 'upload' ? 'uploading' : 'throw yaml at parser'}
		</button>
	</div>
</dialog>
