<script lang="ts">
	import DeviceShell from './DeviceShell.svelte';
	import { captureCameraImage, setCameraTemperature } from '$lib/api/observatory';
	import { getCameraDisplayState } from '$lib/cameraState.js';

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

	type CameraAction = 'capture' | 'temperature';

	let { device, onLifecycleComplete }: Props = $props();

	let exposure = $state(1);
	let binX = $state(1);
	let binY = $state(1);
	let targetTemperature = $state(-10);
	let pending = $state<CameraAction | null>(null);
	let error = $state<string | null>(null);
	let targetInitialized = $state(false);

	const displayState = $derived(getCameraDisplayState(device.state));
	const canCommand = $derived(device.connected && pending === null);
	const progressPercent = $derived(displayState.percentCompleted ?? 0);

	function formatNumber(value: number | null, digits = 1) {
		return value === null ? '--' : value.toFixed(digits);
	}

	function formatPercent(value: number | null) {
		return value === null ? '--' : `${Math.round(value)}%`;
	}

	function formatBoolean(value: boolean | null, trueLabel: string, falseLabel: string) {
		if (value === null) return '--';
		return value ? trueLabel : falseLabel;
	}

	function normalizePositiveInteger(value: number) {
		return Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
	}

	async function run(action: CameraAction) {
		if (!canCommand) return;

		pending = action;
		error = null;

		try {
			if (action === 'temperature') {
				await setCameraTemperature(device.id, targetTemperature);
			} else {
				await captureCameraImage(
					device.id,
					exposure,
					normalizePositiveInteger(binX),
					normalizePositiveInteger(binY)
				);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Camera command failed';
		} finally {
			pending = null;
		}
	}

	$effect(() => {
		if (targetInitialized || displayState.targetTemperature === null) return;

		targetTemperature = displayState.targetTemperature;
		targetInitialized = true;
	});
</script>

<DeviceShell {device} {onLifecycleComplete} showStatus={false}>
	<div class="grid gap-2">
		<div class="grid grid-cols-2 gap-1.5 font-mono xl:grid-cols-5">
			<div class="min-w-0 border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<p class="text-[0.6rem] uppercase text-neutral-400">Temp</p>
				<p class="truncate text-sm font-black leading-none">
					{formatNumber(displayState.temperature)} C
				</p>
			</div>

			<div class="min-w-0 border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<p class="text-[0.6rem] uppercase text-neutral-400">Target</p>
				<p class="truncate text-sm font-black leading-none">
					{formatNumber(displayState.targetTemperature)} C
				</p>
			</div>

			<div class="min-w-0 border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<p class="text-[0.6rem] uppercase text-neutral-400">Cooler</p>
				<p class="truncate text-sm font-black leading-none">
					{formatPercent(displayState.coolerPower)}
				</p>
			</div>

			<div
				class="min-w-0 border bg-neutral-900 px-2 py-1.5"
				class:border-yellow-300={displayState.exposing === true}
				class:border-neutral-700={displayState.exposing !== true}
			>
				<p class="text-[0.6rem] uppercase text-neutral-400">Exposure</p>
				<p class="truncate text-sm font-black uppercase leading-none">
					{formatBoolean(displayState.exposing, 'active', 'idle')}
				</p>
			</div>

			<div class="min-w-0 border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<p class="text-[0.6rem] uppercase text-neutral-400">Done</p>
				<p class="truncate text-sm font-black leading-none">
					{formatPercent(displayState.percentCompleted)}
				</p>
			</div>
		</div>

		<div class="grid gap-2 font-mono">
			<div class="grid gap-2 border border-neutral-700 bg-neutral-900 p-2">
				<div class="grid grid-cols-3 gap-1.5">
					<label class="min-w-0">
						<span class="text-[0.6rem] uppercase text-neutral-400">Exposure s</span>
						<input
							type="number"
							min="0.001"
							step="0.1"
							bind:value={exposure}
							disabled={!device.connected || pending !== null}
							class="mt-0.5 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-1 text-sm font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
						/>
					</label>

					<label class="min-w-0">
						<span class="text-[0.6rem] uppercase text-neutral-400">Bin X</span>
						<input
							type="number"
							min="1"
							step="1"
							bind:value={binX}
							disabled={!device.connected || pending !== null}
							class="mt-0.5 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-1 text-sm font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
						/>
					</label>

					<label class="min-w-0">
						<span class="text-[0.6rem] uppercase text-neutral-400">Bin Y</span>
						<input
							type="number"
							min="1"
							step="1"
							bind:value={binY}
							disabled={!device.connected || pending !== null}
							class="mt-0.5 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-1 text-sm font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
						/>
					</label>
				</div>

				<button
					type="button"
					disabled={!canCommand}
					onclick={() => run('capture')}
					class="border border-[#80499c] bg-neutral-800 px-3 py-2 text-sm font-black uppercase text-neutral-100 shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
				>
					{pending === 'capture' ? 'capturing' : 'capture'}
				</button>
			</div>

			<div class="grid grid-cols-2 gap-2 font-mono">
				<div class="grid grid-cols-[1fr_auto] items-end gap-2 border border-neutral-700 bg-neutral-900 p-2">
					<label class="min-w-0">
						<span class="text-[0.6rem] uppercase text-neutral-400">Set temp C</span>
						<input
							type="number"
							step="0.5"
							bind:value={targetTemperature}
							disabled={!device.connected || pending !== null}
							class="mt-0.5 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-1 text-sm font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
						/>
					</label>

					<button
						type="button"
						disabled={!canCommand}
						onclick={() => run('temperature')}
						class="border border-[#80499c] bg-neutral-800 px-3 py-1.5 text-sm font-black uppercase text-neutral-100 shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
					>
						{pending === 'temperature' ? 'setting' : 'set'}
					</button>
				</div>

				<div class="grid content-center gap-1 border border-neutral-700 bg-neutral-900 p-2">
					<div class="flex items-center justify-between gap-2 font-mono">
						<span class="text-[0.6rem] uppercase text-neutral-400">Progress</span>
						<span class="text-xs font-black">{formatPercent(displayState.percentCompleted)}</span>
					</div>

					<div class="h-3 border border-neutral-700 bg-neutral-950">
						<div class="h-full bg-[#80499c]" style:width={`${progressPercent}%`}></div>
					</div>
				</div>
			</div>
		</div>

		{#if error}
			<p class="truncate border border-red-500 bg-red-950 p-1 font-mono text-xs text-red-100">
				{error}
			</p>
		{/if}
	</div>
</DeviceShell>