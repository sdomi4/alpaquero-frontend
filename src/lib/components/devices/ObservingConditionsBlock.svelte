<script lang="ts">
	import DeviceShell from './DeviceShell.svelte';
	import { getObservingConditionsDisplayState } from '$lib/observingConditionsState.js';

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

	const conditions = $derived(getObservingConditionsDisplayState(device.state));
	const rainState = $derived(getRainState(conditions.rain));
	const daylightState = $derived(getDaylightState(conditions.daylight));
	const windState = $derived(getWindState(conditions.wind));
	const dewState = $derived(getDewState(conditions.dewPointSpread));

	function formatNumber(value: number | null, digits = 1) {
		return value === null ? '--' : value.toFixed(digits);
	}

	function formatInteger(value: number | null) {
		return value === null ? '--' : String(Math.round(value));
	}

	function formatPercent(value: number | null) {
		return value === null ? '--' : `${Math.round(value)}%`;
	}

	function barWidth(value: number | null, max: number) {
		if (value === null) return '0%';
		return `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
	}

	function getRainState(value: number | null) {
		if (value === null) return 'unknown';
		return value > 0 ? 'wet' : 'dry';
	}

	function getDaylightState(value: number | null) {
		if (value === null) return 'unknown';
		if (value >= 70) return 'day';
		if (value >= 25) return 'twilight';
		return 'dark';
	}

	function getWindState(value: number | null) {
		if (value === null) return 'unknown';
		if (value >= 10) return 'strong';
		if (value >= 5) return 'breeze';
		return 'calm';
	}

	function getDewState(value: number | null) {
		if (value === null) return 'unknown';
		if (value <= 2) return 'tight';
		if (value <= 5) return 'watch';
		return 'clear';
	}
</script>

<DeviceShell {device} {onLifecycleComplete} showStatus={false}>
	<div class="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-2">
		<div class="grid grid-cols-4 gap-1.5 font-mono">
			<div class="border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<p class="text-[0.6rem] text-neutral-400 uppercase">Ambient</p>
				<p class="truncate text-base leading-none font-black">
					{formatNumber(conditions.ambient)} C
				</p>
			</div>

			<div class="border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<p class="text-[0.6rem] text-neutral-400 uppercase">Sky</p>
				<p class="truncate text-base leading-none font-black">
					{formatNumber(conditions.skyAmbient)} C
				</p>
			</div>

			<div class="border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<p class="text-[0.6rem] text-neutral-400 uppercase">Humidity</p>
				<p class="truncate text-base leading-none font-black">
					{formatPercent(conditions.humidity)}
				</p>
			</div>

			<div class="border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<p class="text-[0.6rem] text-neutral-400 uppercase">Pressure</p>
				<p class="truncate text-base leading-none font-black">
					{formatInteger(conditions.pressure)}
				</p>
			</div>
		</div>

		<div class="grid min-h-0 grid-cols-[minmax(12rem,0.9fr)_minmax(0,1fr)] gap-2">
			<div class="grid content-start gap-1.5 font-mono">
				<div
					class="border bg-neutral-900 p-2"
					class:border-emerald-400={rainState === 'dry'}
					class:border-red-400={rainState === 'wet'}
					class:border-neutral-700={rainState === 'unknown'}
				>
					<div class="flex items-center justify-between gap-2">
						<p class="text-[0.6rem] text-neutral-400 uppercase">Rain</p>
						<p class="text-xs font-black uppercase">{rainState}</p>
					</div>
					<p class="mt-1 text-lg leading-none font-black">{formatNumber(conditions.rain)}</p>
				</div>

				<div
					class="border bg-neutral-900 p-2"
					class:border-emerald-400={dewState === 'clear'}
					class:border-yellow-300={dewState === 'watch'}
					class:border-red-400={dewState === 'tight'}
					class:border-neutral-700={dewState === 'unknown'}
				>
					<div class="flex items-center justify-between gap-2">
						<p class="text-[0.6rem] text-neutral-400 uppercase">Dew Spread</p>
						<p class="text-xs font-black uppercase">{dewState}</p>
					</div>
					<p class="mt-1 text-lg leading-none font-black">
						{formatNumber(conditions.dewPointSpread)} C
					</p>
				</div>

				<div class="border border-neutral-700 bg-neutral-900 p-2">
					<div class="flex items-center justify-between gap-2">
						<p class="text-[0.6rem] text-neutral-400 uppercase">Sky Delta</p>
						<p class="text-xs font-black uppercase">sky - air</p>
					</div>
					<p class="mt-1 text-lg leading-none font-black">
						{formatNumber(conditions.skyDelta)} C
					</p>
				</div>
			</div>

			<div class="grid content-start gap-2 font-mono">
				<div class="border border-neutral-700 bg-neutral-900 p-2">
					<div class="mb-1 flex items-center justify-between gap-2">
						<p class="text-[0.6rem] text-neutral-400 uppercase">Wind</p>
						<p class="text-xs font-black uppercase">{windState}</p>
					</div>
					<div class="h-2 border border-neutral-700 bg-neutral-950">
						<div
							class="h-full"
							class:bg-emerald-400={windState === 'calm'}
							class:bg-yellow-300={windState === 'breeze'}
							class:bg-red-400={windState === 'strong'}
							class:bg-neutral-700={windState === 'unknown'}
							style:width={barWidth(conditions.wind, 15)}
						></div>
					</div>
					<p class="mt-1 text-xs text-neutral-300">{formatNumber(conditions.wind)} m/s</p>
				</div>

				<div class="border border-neutral-700 bg-neutral-900 p-2">
					<div class="mb-1 flex items-center justify-between gap-2">
						<p class="text-[0.6rem] text-neutral-400 uppercase">Daylight</p>
						<p class="text-xs font-black uppercase">{daylightState}</p>
					</div>
					<div class="h-2 border border-neutral-700 bg-neutral-950">
						<div
							class="h-full"
							class:bg-neutral-500={daylightState === 'dark'}
							class:bg-yellow-300={daylightState === 'twilight' || daylightState === 'day'}
							class:bg-neutral-700={daylightState === 'unknown'}
							style:width={barWidth(conditions.daylight, 100)}
						></div>
					</div>
					<p class="mt-1 text-xs text-neutral-300">{formatPercent(conditions.daylight)}</p>
				</div>

				<div class="border border-neutral-700 bg-neutral-900 p-2">
					<div class="mb-1 flex items-center justify-between gap-2">
						<p class="text-[0.6rem] text-neutral-400 uppercase">Dew Point</p>
						<p class="text-xs font-black uppercase">temperature</p>
					</div>
					<p class="text-lg leading-none font-black">{formatNumber(conditions.dewPoint)} C</p>
				</div>
			</div>
		</div>
	</div>
</DeviceShell>
