<script lang="ts">
	import DeviceShell from './DeviceShell.svelte';
	import { closeCover, openCover, turnCalibratorOff, turnCalibratorOn } from '$lib/api/observatory';

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

	let coverPending = $state<'open' | 'close' | null>(null);
	let calibratorPending = $state<'on' | 'off' | null>(null);
	let error = $state<string | null>(null);
	let safetyOverride = $state(false);
	let targetBrightness = $state(100);

	const coverStatus = $derived(Number(device.state?.cover_status ?? NaN));
	const calibratorStatus = $derived(Number(device.state?.calibrator_status ?? NaN));
	const brightness = $derived(Number(device.state?.brightness ?? NaN));

	const coverLabel = $derived(getCoverLabel(coverStatus));
	const calibratorLabel = $derived(getCalibratorLabel(calibratorStatus));

	const coverMoving = $derived(coverStatus === 2);
	const coverClosed = $derived(coverStatus === 1);
	const coverOpen = $derived(coverStatus === 3);
	const coverError = $derived(coverStatus === 5);

	const calibratorOff = $derived(calibratorStatus === 1);
	const calibratorReady = $derived(calibratorStatus === 3);
	const calibratorError = $derived(calibratorStatus === 5);

	function getCoverLabel(value: number) {
		switch (value) {
			case 0:
				return 'not present';
			case 1:
				return 'closed';
			case 2:
				return 'moving';
			case 3:
				return 'open';
			case 4:
				return 'unknown';
			case 5:
				return 'error';
			default:
				return 'unknown';
		}
	}

	function getCalibratorLabel(value: number) {
		switch (value) {
			case 0:
				return 'not present';
			case 1:
				return 'off';
			case 2:
				return 'not ready';
			case 3:
				return 'ready';
			case 4:
				return 'unknown';
			case 5:
				return 'error';
			default:
				return 'unknown';
		}
	}

	function clampBrightness(value: number) {
		return Math.max(0, Math.min(100, Math.round(value)));
	}

	async function runCover(action: 'open' | 'close') {
		if (!device.connected || coverPending || coverMoving) return;

		coverPending = action;
		error = null;

		try {
			if (action === 'open') {
				await openCover(device.id, safetyOverride);
			} else {
				await closeCover(device.id, safetyOverride);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : `Cover ${action} failed`;
		} finally {
			coverPending = null;
		}
	}

	async function setCalibrator(action: 'on' | 'off') {
		if (!device.connected || calibratorPending) return;

		calibratorPending = action;
		error = null;

		try {
			if (action === 'on') {
				await turnCalibratorOn(device.id, clampBrightness(targetBrightness));
			} else {
				await turnCalibratorOff(device.id);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : `Calibrator ${action} failed`;
		} finally {
			calibratorPending = null;
		}
	}
</script>

<DeviceShell {device} {onLifecycleComplete} showStatus={false}>
	<div class="grid gap-1.5">
		<div class="grid grid-cols-[1fr_1fr_1.35fr_auto] gap-1.5 font-mono">
			<div
				class="min-w-0 border bg-neutral-900 p-1.5"
				class:border-neutral-500={!coverError}
				class:border-red-500={coverError}
				class:bg-red-950={coverError}
			>
				<p class="text-[0.65rem] text-neutral-400 uppercase">Cover</p>
				<p class="truncate text-base leading-none font-black uppercase">{coverLabel}</p>
			</div>

			<div
				class="min-w-0 border bg-neutral-900 p-1.5"
				class:border-neutral-500={!calibratorError}
				class:border-red-500={calibratorError}
				class:bg-red-950={calibratorError}
			>
				<p class="text-[0.65rem] text-neutral-400 uppercase">Cal</p>
				<p class="truncate text-base leading-none font-black uppercase">{calibratorLabel}</p>
			</div>

			<div
				class="grid min-w-0 grid-cols-[1fr_3.75rem] items-center gap-1.5 border border-neutral-700 bg-neutral-900 p-1.5"
			>
				<div class="min-w-0">
					<p class="text-[0.65rem] text-neutral-400 uppercase">Brightness</p>
					<p class="truncate text-base leading-none font-black">
						{Number.isNaN(brightness) ? '--' : brightness}
					</p>
					<input
						id={`brightness-slider-${device.id}`}
						type="range"
						min="0"
						max="100"
						step="1"
						bind:value={targetBrightness}
						disabled={!device.connected || calibratorPending !== null}
						class="h-4 w-full accent-[#80499c] disabled:opacity-40"
					/>
				</div>

				<label
					class="min-w-0 text-[0.65rem] text-neutral-500 uppercase"
					for={`brightness-number-${device.id}`}
				>
					Tgt

					<input
						id={`brightness-number-${device.id}`}
						type="number"
						min="0"
						max="100"
						bind:value={targetBrightness}
						onchange={() => {
							targetBrightness = clampBrightness(targetBrightness);
						}}
						disabled={!device.connected || calibratorPending !== null}
						class="mt-0.5 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-100 outline-none focus:border-[#80499c] disabled:border-neutral-700 disabled:text-neutral-600"
					/>
				</label>
			</div>

			<label
				class="flex cursor-pointer items-center justify-center gap-1.5 border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-[0.65rem]"
				title="Safety override"
			>
				<span class="text-neutral-400 uppercase">Safe</span>
				<input type="checkbox" bind:checked={safetyOverride} class="h-4 w-4 accent-red-600" />
			</label>
		</div>

		<div class="grid grid-cols-4 gap-1.5">
			<button
				type="button"
				disabled={!device.connected || calibratorPending !== null}
				onclick={() => setCalibrator('on')}
				class="border border-[#80499c] bg-neutral-800 px-2 py-1 font-mono text-xs font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
			>
				{#if calibratorPending === 'on'}
					setting
				{:else if calibratorReady}
					update
				{:else}
					cal on
				{/if}
			</button>

			<button
				type="button"
				disabled={!device.connected || calibratorPending !== null || calibratorOff}
				onclick={() => setCalibrator('off')}
				class="border border-[#80499c] bg-neutral-800 px-2 py-1 font-mono text-xs font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
			>
				{calibratorPending === 'off' ? 'stopping' : 'cal off'}
			</button>

			<button
				type="button"
				disabled={!device.connected || coverPending !== null || coverMoving || coverOpen}
				onclick={() => runCover('open')}
				class="border border-[#80499c] bg-neutral-800 px-2 py-1 font-mono text-xs font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
			>
				{coverPending === 'open' || coverMoving ? 'opening' : 'open'}
			</button>

			<button
				type="button"
				disabled={!device.connected || coverPending !== null || coverMoving || coverClosed}
				onclick={() => runCover('close')}
				class="border border-[#80499c] bg-neutral-800 px-2 py-1 font-mono text-xs font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
			>
				{coverPending === 'close' || coverMoving ? 'closing' : 'close'}
			</button>
		</div>

		{#if error}
			<p class="border border-red-500 bg-red-950 p-1 font-mono text-xs text-red-100">
				{error}
			</p>
		{/if}
	</div>
</DeviceShell>
