<script lang="ts">
	import { onMount } from 'svelte';
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
	let fileSuffix = $state('');
	let nowMs = $state(Date.now());

	const displayState = $derived(getCameraDisplayState(device.state));
	const canCommand = $derived(device.connected && pending === null);

	const exposureStartTimeUtc = $derived(readString(device.state?.last_exposure_start_time));
	const exposureDuration = $derived(readNumber(device.state?.last_exposure_duration));

	const backendProgressPercent = $derived(readNumber(device.state?.percent_completed));
	const calculatedProgressPercent = $derived(
		calculateExposurePercent(exposureStartTimeUtc, exposureDuration)
	);

	const progressPercent = $derived(
		backendProgressPercent ?? displayState.percentCompleted ?? calculatedProgressPercent ?? 0
	);

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

	function formatDuration(value: number | null) {
		if (value === null) return '--';
		return `${value.toFixed(value < 10 ? 1 : 0)}s`;
	}

	function formatUtcTime(value: string | null) {
		const ms = parseUtcMs(value);

		if (ms === null) return '--';

		return new Date(ms).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function normalizePositiveInteger(value: number) {
		return Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
	}

	function readNumber(...values: unknown[]) {
		for (const value of values) {
			if (typeof value === 'number' && Number.isFinite(value)) return value;
			if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
				return Number(value);
			}
		}

		return null;
	}

	function readString(...values: unknown[]) {
		for (const value of values) {
			if (typeof value === 'string' && value.trim() !== '') return value;
		}

		return null;
	}

	function parseUtcMs(value: string | null) {
		if (!value) return null;

		const hasTimezone = value.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(value);
		const normalized = hasTimezone ? value : `${value}Z`;
		const parsed = Date.parse(normalized);

		return Number.isFinite(parsed) ? parsed : null;
	}

	function calculateExposurePercent(startTimeUtc: string | null, durationSeconds: number | null) {
		const startMs = parseUtcMs(startTimeUtc);

		if (startMs === null || durationSeconds === null || durationSeconds <= 0) return null;

		const elapsedMs = nowMs - startMs;
		const durationMs = durationSeconds * 1000;

		return Math.max(0, Math.min(100, (elapsedMs / durationMs) * 100));
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
					normalizePositiveInteger(binY),
					fileSuffix
				);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Camera command failed';
		} finally {
			pending = null;
		}
	}

	onMount(() => {
		const interval = window.setInterval(() => {
			nowMs = Date.now();
		}, 250);

		return () => window.clearInterval(interval);
	});

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
					{formatPercent(progressPercent)}
				</p>
			</div>
		</div>

		<div class="grid gap-2 font-mono">
			<div class="grid gap-2 border border-neutral-700 bg-neutral-900 p-2">
				<div class="grid grid-cols-4 gap-1.5">
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

					<label class="min-w-0">
						<span class="text-[0.6rem] uppercase text-neutral-400">Suffix</span>
						<input
							type="text"
							list={`suffix-presets-${device.id}`}
							placeholder="none"
							bind:value={fileSuffix}
							disabled={!device.connected || pending !== null}
							class="mt-0.5 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-1 text-sm font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
						/>

						<datalist id={`suffix-presets-${device.id}`}>
							<option value="dark"></option>
							<option value="flat"></option>
							<option value="bias"></option>
							<option value="calib"></option>
						</datalist>
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
						<span class="text-xs font-black">{formatPercent(progressPercent)}</span>
					</div>

					<div class="h-3 border border-neutral-700 bg-neutral-950">
						<div class="h-full bg-[#80499c]" style:width={`${progressPercent}%`}></div>
					</div>

					<div class="flex items-center justify-between gap-2 text-[0.6rem] uppercase text-neutral-500">
						<span>last {formatUtcTime(exposureStartTimeUtc)}</span>
						<span>dur {formatDuration(exposureDuration)}</span>
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