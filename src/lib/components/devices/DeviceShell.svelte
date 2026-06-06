<script lang="ts">
	import type { Snippet } from 'svelte';
	import { runDeviceLifecycleAction } from '$lib/api/observatory';

	type Device = {
		id: string;
		type: string;
		name: string;
		connected: boolean;
		status?: string;
	};

	type Props = {
		device: Device;
		children?: Snippet;
		onLifecycleComplete?: (deviceId: string, action: 'startup' | 'shutdown') => void;
		showStatus?: boolean;
	};

	let { device, children, onLifecycleComplete, showStatus = true }: Props = $props();

	let pending = $state(false);
	let error = $state<string | null>(null);

	const displayStatus = $derived(device.connected ? (device.status ?? 'unknown') : 'disconnected');

	async function toggleConnection() {
		if (pending) return;

		pending = true;
		error = null;

		try {
			const action = device.connected ? 'shutdown' : 'startup';

			await runDeviceLifecycleAction(device.type, device.id, action);

			onLifecycleComplete?.(device.id, action);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Device action failed';
		} finally {
			pending = false;
		}
	}
</script>

<article
	class="flex h-full max-h-full w-fit justify-self-start flex-col border border-neutral-700 bg-neutral-950 p-1.5 shadow-[2px_2px_0_#80499c]"
	class:opacity-60={!device.connected}
>
	<header class="mb-1.5 flex items-center justify-between gap-2">
		<div class="flex min-w-0 items-center gap-1.5">
			<h3 class="truncate text-xs leading-tight font-black uppercase">
				{device.name}
			</h3>

			{#if showStatus}
				<span
					class="shrink-0 border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 font-mono text-[0.6rem] leading-none text-purple-200 uppercase"
				>
					{displayStatus}
				</span>
			{/if}
		</div>

		<button
			type="button"
			onclick={toggleConnection}
			disabled={pending}
			class="shrink-0 border px-1.5 py-0.5 font-mono text-[0.6rem] leading-none font-black uppercase transition-transform active:translate-x-[1px] active:translate-y-[1px]"
			class:border-[#80499c]={device.connected}
			class:bg-[#80499c]={device.connected}
			class:text-neutral-50={device.connected}
			class:bg-red-700={!device.connected}
			class:text-neutral-100={!device.connected}
			class:cursor-wait={pending}
			title={device.connected ? 'Shutdown device' : 'Startup device'}
		>
			{#if pending}
				working
			{:else if device.connected}
				online
			{:else}
				offline
			{/if}
		</button>
	</header>

	{#if error}
		<p class="mb-1 border border-red-500 bg-red-950 p-1 font-mono text-xs text-red-100">
			{error}
		</p>
	{/if}

	<div class="min-h-0 flex-1 overflow-hidden">
		{@render children?.()}
	</div>
</article>
