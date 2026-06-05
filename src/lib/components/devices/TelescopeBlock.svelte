<script lang="ts">
	import DeviceShell from './DeviceShell.svelte';
	import {
		parkTelescope,
		slewTelescope,
		slewTelescopeToSun,
		unparkTelescope
	} from '$lib/api/observatory';
	import { getTelescopeDisplayState } from '$lib/telescopeState.js';

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

	type TelescopeAction = 'park' | 'unpark' | 'slew' | 'sun';

	let { device, onLifecycleComplete }: Props = $props();

	let targetRa = $state(0);
	let targetDec = $state(0);
	let safetyOverride = $state(false);
	let pending = $state<TelescopeAction | null>(null);
	let error = $state<string | null>(null);
	let targetsInitialized = $state(false);

	const displayState = $derived(getTelescopeDisplayState(device.state));
	const canCommand = $derived(device.connected && pending === null);

	function formatNumber(value: number | null, digits = 2) {
		return value === null ? '--' : value.toFixed(digits);
	}

	function formatBoolean(value: boolean | null, trueLabel: string, falseLabel: string) {
		if (value === null) return '--';
		return value ? trueLabel : falseLabel;
	}

	async function run(action: TelescopeAction) {
		if (!canCommand) return;

		pending = action;
		error = null;

		try {
			if (action === 'park') {
				await parkTelescope(device.id, safetyOverride);
			} else if (action === 'unpark') {
				await unparkTelescope(device.id, safetyOverride);
			} else if (action === 'sun') {
				await slewTelescopeToSun(device.id, safetyOverride);
			} else {
				await slewTelescope(device.id, targetRa, targetDec, safetyOverride);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Telescope command failed';
		} finally {
			pending = null;
		}
	}

	$effect(() => {
		if (targetsInitialized) return;

		if (displayState.targetRa !== null) {
			targetRa = displayState.targetRa;
		} else if (displayState.positionRa !== null) {
			targetRa = displayState.positionRa;
		}

		if (displayState.targetDec !== null) {
			targetDec = displayState.targetDec;
		} else if (displayState.positionDec !== null) {
			targetDec = displayState.positionDec;
		}

		if (
			displayState.targetRa !== null ||
			displayState.targetDec !== null ||
			displayState.positionRa !== null ||
			displayState.positionDec !== null
		) {
			targetsInitialized = true;
		}
	});
</script>

<DeviceShell {device} {onLifecycleComplete} showStatus={false}>
	<div class="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2">
		<div class="grid grid-cols-6 gap-1.5 font-mono">
			<div class="min-w-0 border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<p class="text-[0.6rem] text-neutral-400 uppercase">RA</p>
				<p class="truncate text-sm leading-none font-black">
					{formatNumber(displayState.positionRa, 4)}
				</p>
			</div>

			<div class="min-w-0 border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<p class="text-[0.6rem] text-neutral-400 uppercase">Dec</p>
				<p class="truncate text-sm leading-none font-black">
					{formatNumber(displayState.positionDec, 4)}
				</p>
			</div>

			<div class="min-w-0 border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<p class="text-[0.6rem] text-neutral-400 uppercase">Target RA</p>
				<p class="truncate text-sm leading-none font-black">
					{formatNumber(displayState.targetRa, 4)}
				</p>
			</div>

			<div class="min-w-0 border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<p class="text-[0.6rem] text-neutral-400 uppercase">Target Dec</p>
				<p class="truncate text-sm leading-none font-black">
					{formatNumber(displayState.targetDec, 4)}
				</p>
			</div>

			<div
				class="min-w-0 border bg-neutral-900 px-2 py-1.5"
				class:border-emerald-400={displayState.parked === true}
				class:border-neutral-700={displayState.parked !== true}
			>
				<p class="text-[0.6rem] text-neutral-400 uppercase">Park</p>
				<p class="truncate text-sm leading-none font-black uppercase">
					{formatBoolean(displayState.parked, 'parked', 'free')}
				</p>
			</div>

			<div
				class="min-w-0 border bg-neutral-900 px-2 py-1.5"
				class:border-yellow-300={displayState.slewing === true}
				class:border-neutral-700={displayState.slewing !== true}
			>
				<p class="text-[0.6rem] text-neutral-400 uppercase">Motion</p>
				<p class="truncate text-sm leading-none font-black uppercase">
					{displayState.slewing === true
						? 'slewing'
						: formatBoolean(displayState.tracking, 'tracking', 'idle')}
				</p>
			</div>
		</div>

		<div class="grid min-h-0 grid-cols-[minmax(12rem,0.8fr)_minmax(0,1fr)] gap-2 font-mono">
			<div class="grid content-start gap-1.5 border border-neutral-700 bg-neutral-900 p-2">
				<label class="min-w-0">
					<span class="text-[0.6rem] text-neutral-400 uppercase">Command RA</span>
					<input
						type="number"
						step="0.0001"
						bind:value={targetRa}
						disabled={!device.connected || pending !== null}
						class="mt-0.5 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-1 text-sm font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
					/>
				</label>

				<label class="min-w-0">
					<span class="text-[0.6rem] text-neutral-400 uppercase">Command Dec</span>
					<input
						type="number"
						step="0.0001"
						bind:value={targetDec}
						disabled={!device.connected || pending !== null}
						class="mt-0.5 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-1 text-sm font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
					/>
				</label>
			</div>

			<div class="grid min-h-0 grid-cols-2 gap-1.5">
				<button
					type="button"
					disabled={!canCommand}
					onclick={() => run('slew')}
					class="border border-[#80499c] bg-neutral-800 px-3 py-2 text-sm font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
				>
					{pending === 'slew' ? 'slewing' : 'slew'}
				</button>

				<button
					type="button"
					disabled={!canCommand}
					onclick={() => run('sun')}
					class="border border-yellow-300 bg-yellow-950 px-3 py-2 text-sm font-black text-yellow-100 uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-yellow-900 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
				>
					{pending === 'sun' ? 'slewing' : 'sun'}
				</button>

				<button
					type="button"
					disabled={!canCommand || displayState.parked === true}
					onclick={() => run('park')}
					class="border border-[#80499c] bg-neutral-800 px-3 py-2 text-sm font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
				>
					{pending === 'park' ? 'parking' : 'park'}
				</button>

				<button
					type="button"
					disabled={!canCommand || displayState.parked === false}
					onclick={() => run('unpark')}
					class="border border-[#80499c] bg-neutral-800 px-3 py-2 text-sm font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
				>
					{pending === 'unpark' ? 'freeing' : 'unpark'}
				</button>
			</div>
		</div>

		<div class="flex items-center justify-between gap-2">
			<label
				class="flex cursor-pointer items-center gap-1.5 border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-[0.65rem]"
				title="Safety override"
			>
				<span class="text-neutral-400 uppercase">Safe</span>
				<input type="checkbox" bind:checked={safetyOverride} class="h-4 w-4 accent-red-600" />
			</label>

			{#if error}
				<p
					class="min-w-0 flex-1 truncate border border-red-500 bg-red-950 p-1 font-mono text-xs text-red-100"
				>
					{error}
				</p>
			{/if}
		</div>
	</div>
</DeviceShell>
