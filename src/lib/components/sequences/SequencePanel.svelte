<script lang="ts">
	import { resolve } from '$app/paths';
	import { listSequences, runSequence, uploadSequence } from '$lib/api/observatory';

	type Props = {
		availableSequences: unknown;
	};

	let { availableSequences }: Props = $props();

	let refreshedSequences = $state<string[] | null>(null);
	const localSequences = $derived(refreshedSequences ?? normalizeSequences(availableSequences));
	let pending = $state<string | null>(null);
	let error = $state<string | null>(null);
	let uploadResult = $state<string | null>(null);
	let selectedFile = $state<File | null>(null);
	let uploadDialog = $state<HTMLDialogElement | null>(null);

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

	function sequenceEditorHref(sequence: string) {
		return `${resolve('/sequences/new')}?sequence=${encodeURIComponent(sequence)}`;
	}

	async function refreshSequences() {
		refreshedSequences = normalizeSequences(await listSequences());
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

		<div class="flex items-center gap-1">
			<a
				href={resolve('/sequences/new')}
				class="border border-[#80499c] bg-[#211428] px-2 py-0.5 font-mono text-[0.65rem] font-black text-purple-100 uppercase shadow-[2px_2px_0_#80499c] hover:bg-[#2f1c39] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
			>
				new
			</a>
			<button
				type="button"
				onclick={() => uploadDialog?.showModal()}
				class="border border-[#80499c] bg-neutral-800 px-2 py-0.5 font-mono text-[0.65rem] font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
			>
				upload
			</button>
		</div>
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

							<div class="flex shrink-0 items-center gap-1">
								<a
									href={sequenceEditorHref(sequence)}
									aria-label={`Edit sequence ${sequence}`}
									class="border border-sky-700 bg-sky-950 px-2 py-0.5 font-mono text-[0.65rem] font-black text-sky-100 uppercase shadow-[2px_2px_0_#80499c] hover:bg-sky-900 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
								>
									edit
								</a>
								<button
									type="button"
									disabled={pending === `start:${sequence}`}
									onclick={() => start(sequence)}
									class="border border-neutral-500 bg-neutral-800 px-2 py-0.5 font-mono text-[0.65rem] font-black uppercase shadow-[2px_2px_0_#80499c] hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-wait disabled:text-neutral-500 disabled:shadow-none"
								>
									{pending === `start:${sequence}` ? 'starting' : 'start'}
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
