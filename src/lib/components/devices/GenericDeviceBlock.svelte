<script lang="ts">
	import DeviceShell from './DeviceShell.svelte';

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

	function formatValue(value: unknown) {
		if (value === null) return 'null';
		if (value === undefined) return '--';
		if (typeof value === 'boolean') return value ? 'true' : 'false';
		if (typeof value === 'number')
			return Number.isInteger(value) ? String(value) : value.toFixed(2);
		if (typeof value === 'object') return JSON.stringify(value);
		return String(value);
	}
</script>

<DeviceShell {device} {onLifecycleComplete}>
	{#if device.connected && device.state}
		<dl
			class="grid max-h-[7.25rem] grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-x-3 gap-y-1 overflow-y-auto pr-1 font-mono text-[0.7rem]"
		>
			{#each Object.entries(device.state) as [key, value] (key)}
				<div
					class="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] gap-1 border-b border-neutral-700 pb-0.5"
				>
					<dt class="truncate text-neutral-400">{key}</dt>
					<dd class="truncate text-right font-black">
						{formatValue(value)}
					</dd>
				</div>
			{/each}
		</dl>
	{:else}
		<div class="border border-dashed border-neutral-700 p-2 font-mono text-xs text-neutral-500">
			No live state received.
		</div>
	{/if}
</DeviceShell>
