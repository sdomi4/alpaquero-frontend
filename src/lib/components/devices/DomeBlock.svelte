<script lang="ts">
	import DeviceShell from './DeviceShell.svelte';
	import { closeDome, openDome } from '$lib/api/observatory';

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

	let pending = $state<'open' | 'close' | null>(null);
	let error = $state<string | null>(null);
	let safetyOverride = $state(false);

	const shutterStatus = $derived(Number(device.state?.shutter_status ?? device.status ?? NaN));
	const shutterLabel = $derived(getShutterLabel(shutterStatus));

	const isMoving = $derived(shutterStatus === 2 || shutterStatus === 3);
	const isOpen = $derived(shutterStatus === 0);
	const isClosed = $derived(shutterStatus === 1);
	const hasError = $derived(shutterStatus === 4);

	function getShutterLabel(value: number) {
		switch (value) {
			case 0:
				return 'open';
			case 1:
				return 'closed';
			case 2:
				return 'opening';
			case 3:
				return 'closing';
			case 4:
				return 'error';
			default:
				return 'unknown';
		}
	}

	async function run(action: 'open' | 'close') {
		if (!device.connected || pending || isMoving) return;

		pending = action;
		error = null;

		try {
			if (action === 'open') {
				await openDome(device.id, safetyOverride);
			} else {
				await closeDome(device.id, safetyOverride);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : `Dome ${action} failed`;
		} finally {
			pending = null;
		}
	}
</script>

<DeviceShell {device} {onLifecycleComplete} showStatus={false}>
	<div class="grid gap-1.5">
		<div class="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-stretch gap-1.5 font-mono">
			<div
				class="min-w-0 border bg-neutral-900 p-1.5"
				class:border-neutral-500={!hasError}
				class:border-red-500={hasError}
				class:bg-red-950={hasError}
			>
				<span class="text-[0.65rem] text-neutral-400 uppercase">Shutter</span>
				<span class="ml-2 text-sm leading-none font-black uppercase">{shutterLabel}</span>
			</div>

			<button
				type="button"
				disabled={!device.connected || pending !== null || isMoving || isOpen}
				onclick={() => run('open')}
				class="border border-[#80499c] bg-neutral-800 px-3 py-1.5 font-mono text-xs font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
			>
				{pending === 'open' || shutterStatus === 2 ? 'opening' : 'open'}
			</button>

			<button
				type="button"
				disabled={!device.connected || pending !== null || isMoving || isClosed}
				onclick={() => run('close')}
				class="border border-[#80499c] bg-neutral-800 px-3 py-1.5 font-mono text-xs font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
			>
				{pending === 'close' || shutterStatus === 3 ? 'closing' : 'close'}
			</button>

			<label
				class="flex cursor-pointer items-center gap-1.5 border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-[0.65rem]"
				title="Safety override"
			>
				<span class="text-neutral-400 uppercase">Safe</span>
				<input type="checkbox" bind:checked={safetyOverride} class="h-4 w-4 accent-red-600" />
			</label>
		</div>

		{#if error}
			<p class="border border-red-500 bg-red-950 p-1 font-mono text-xs text-red-100">
				{error}
			</p>
		{/if}
	</div>
</DeviceShell>
