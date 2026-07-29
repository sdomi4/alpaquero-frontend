<script lang="ts">
	import { abortSequence, pauseSequence, resumeSequence } from '$lib/api/observatory';

	export type ActiveSequence = {
		context_id: string;
		sequence_name: string;
		status: string;
		info: string | null;
	};

	type Props = {
		sequences: Record<string, ActiveSequence>;
	};

	let { sequences }: Props = $props();

	let pending = $state<string | null>(null);
	let errors = $state<Record<string, string>>({});

	const activeList = $derived(Object.values(sequences ?? {}));

	async function togglePause(sequence: ActiveSequence) {
		const isPaused = sequence.status.toLowerCase() === 'paused';
		pending = `${isPaused ? 'resume' : 'pause'}:${sequence.context_id}`;
		clearError(sequence.context_id);

		try {
			if (isPaused) {
				await resumeSequence(sequence.context_id);
			} else {
				await pauseSequence(sequence.context_id);
			}
		} catch (error) {
			setError(
				sequence.context_id,
				error instanceof Error ? error.message : 'Failed to update sequence'
			);
		} finally {
			pending = null;
		}
	}

	async function abort(sequence: ActiveSequence) {
		pending = `abort:${sequence.context_id}`;
		clearError(sequence.context_id);

		try {
			await abortSequence(sequence.context_id);
		} catch (error) {
			setError(
				sequence.context_id,
				error instanceof Error ? error.message : 'Failed to abort sequence'
			);
		} finally {
			pending = null;
		}
	}

	function clearError(contextId: string) {
		if (!(contextId in errors)) return;

		const next = { ...errors };
		delete next[contextId];
		errors = next;
	}

	function setError(contextId: string, message: string) {
		errors = { ...errors, [contextId]: message };
	}
</script>

{#if activeList.length > 0}
	<section class="min-w-0 flex-1 overflow-x-auto" aria-label="Running sequences">
		<div class="flex min-w-max items-stretch gap-1.5">
			{#each activeList as sequence (sequence.context_id)}
				<article
					class="grid w-64 flex-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 border border-[#80499c] bg-[#211428] px-2 py-1.5 font-mono text-xs text-purple-100"
					title={errors[sequence.context_id] ?? undefined}
				>
					<p
						class="min-w-0 truncate text-xs leading-none font-black"
						title={sequence.sequence_name}
					>
						{sequence.sequence_name}
					</p>

					<div class="flex shrink-0 items-center gap-1">
						<span
							class="shrink-0 border border-purple-400 bg-neutral-950 px-1.5 py-1 text-[0.6rem] leading-none font-black uppercase"
							class:border-red-400={Boolean(errors[sequence.context_id])}
							class:text-red-100={Boolean(errors[sequence.context_id])}
						>
							{errors[sequence.context_id] ? 'error' : sequence.status}
						</span>

						<button
							type="button"
							onclick={() => togglePause(sequence)}
							disabled={pending?.endsWith(sequence.context_id)}
							aria-label={`${sequence.status.toLowerCase() === 'paused' ? 'Resume' : 'Pause'} sequence ${sequence.sequence_name}`}
							class="border border-neutral-500 bg-neutral-800 px-1.5 py-1 text-[0.6rem] leading-none font-black uppercase shadow-[1px_1px_0_#80499c] hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-wait disabled:text-neutral-500 disabled:shadow-none"
						>
							{sequence.status.toLowerCase() === 'paused' ? 'resume' : 'pause'}
						</button>

						<button
							type="button"
							onclick={() => abort(sequence)}
							disabled={pending?.endsWith(sequence.context_id)}
							aria-label={`Abort sequence ${sequence.sequence_name}`}
							class="border border-red-400 bg-red-950 px-1.5 py-1 text-[0.6rem] leading-none font-black text-red-100 uppercase shadow-[1px_1px_0_#80499c] hover:bg-red-900 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-wait disabled:text-neutral-500 disabled:shadow-none"
						>
							abort
						</button>
					</div>

					<p
						class="col-span-full min-w-0 truncate text-[0.65rem] leading-none text-neutral-300"
						class:text-neutral-500={!sequence.info}
						title={sequence.info ?? 'No info'}
					>
						{sequence.info || '—'}
					</p>
				</article>
			{/each}
		</div>
	</section>
{/if}
