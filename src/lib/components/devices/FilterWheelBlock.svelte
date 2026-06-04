<script lang="ts">
	import DeviceShell from './DeviceShell.svelte';
	import { moveFilterWheel } from '$lib/api/observatory';

	type Device = {
		id: string;
		type: string;
		name: string;
		connected: boolean;
		status?: string;
		state: Record<string, unknown> | null;
	};

	type Props = {
		device: Device;
		onLifecycleComplete?: (deviceId: string, action: 'startup' | 'shutdown') => void;
	};

	let { device, onLifecycleComplete }: Props = $props();

	let targetPosition = $state(0);
	let pending = $state(false);
	let error = $state<string | null>(null);

	const currentPosition = $derived(
		Number(
			device.state?.position ??
				device.state?.filter_position ??
				device.state?.filterPosition ??
				device.state?.Position ??
				NaN
		)
	);

	const positionLabel = $derived(
		currentPosition === -1
			? 'moving'
			: Number.isNaN(currentPosition)
				? '--'
				: String(currentPosition)
	);

	const filterNames = $derived(
		Array.isArray(device.state?.names)
			? (device.state.names as unknown[]).map(String)
			: Array.isArray(device.state?.filter_names)
				? (device.state.filter_names as unknown[]).map(String)
				: []
	);

	const positionCount = $derived(filterNames.length > 0 ? filterNames.length : 8);
	const positions = $derived(Array.from({ length: positionCount }, (_, position) => position));

	async function moveToPosition(position: number) {
		if (pending || !device.connected) return;

		pending = true;
		error = null;

		try {
			await moveFilterWheel(device.id, position);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Filter wheel move failed';
		} finally {
			pending = false;
		}
	}
</script>

<DeviceShell {device} {onLifecycleComplete} showStatus={false}>
	<div class="grid gap-1.5">
		<div class="grid grid-cols-[auto_5rem_auto] items-stretch gap-1.5 font-mono">
			<div class="border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<span class="text-[0.65rem] text-neutral-400 uppercase">Current</span>
				<span class="ml-2 text-sm leading-none font-black">{positionLabel}</span>
			</div>

			<label class="border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<span class="text-[0.65rem] text-neutral-400 uppercase">Target</span>
				<input
					type="number"
					min="0"
					max={positionCount - 1}
					bind:value={targetPosition}
					disabled={!device.connected || pending || currentPosition === -1}
					class="mt-0.5 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-0.5 font-mono text-xs font-black text-neutral-100 outline-none focus:border-[#80499c]"
				/>
			</label>

			<button
				type="button"
				disabled={!device.connected || pending || currentPosition === -1}
				onclick={() => moveToPosition(targetPosition)}
				class="border border-[#80499c] bg-neutral-800 px-3 py-1 font-mono text-xs font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
			>
				{pending || currentPosition === -1 ? 'moving' : 'move'}
			</button>
		</div>

		<div
			class="grid max-h-[5.75rem] grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] gap-1.5 overflow-y-auto pr-1"
		>
			{#each positions as position (position)}
				<button
					type="button"
					disabled={!device.connected || pending || currentPosition === -1}
					onclick={() => moveToPosition(position)}
					class="min-w-0 border px-1.5 py-1 text-left font-mono text-xs font-black uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:border-[#80499c] hover:bg-neutral-800 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-800 disabled:text-neutral-600 disabled:shadow-none disabled:hover:bg-neutral-950"
					class:border-[#80499c]={position === currentPosition}
					class:bg-[#80499c]={position === currentPosition}
					class:text-neutral-50={position === currentPosition}
					class:bg-neutral-950={position !== currentPosition}
					class:text-neutral-200={position !== currentPosition}
				>
					<span class="mr-1 opacity-70">{position}</span>
					<span class="truncate leading-tight">{filterNames[position] ?? `Filter ${position}`}</span
					>
				</button>
			{/each}
		</div>

		{#if error}
			<p class="border border-red-500 bg-red-950 p-1 font-mono text-xs text-red-100">
				{error}
			</p>
		{/if}
	</div>
</DeviceShell>
