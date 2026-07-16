<script lang="ts">
	import DeviceShell from './DeviceShell.svelte';
	import { moveFocuser, nudgeFocuser, stopFocuser } from '$lib/api/observatory';

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
	let nudgeAmount = $state(1);
	let controlsInitialized = $state(false);
	let pending = $state(false);
	let error = $state<string | null>(null);

	const position = $derived(toOptionalNumber(device.state?.position));
	const isMoving = $derived(Boolean(device.state?.is_moving));
	const temperature = $derived(toOptionalNumber(device.state?.temperature));
	const stepSize = $derived(toPositiveInteger(device.state?.step_size, 1));
	const maxIncrement = $derived(toOptionalPositiveInteger(device.state?.max_increment));
	const maxStep = $derived(toOptionalPositiveInteger(device.state?.max_step));
	const controlsDisabled = $derived(!device.connected || pending || isMoving);

	$effect(() => {
		if (controlsInitialized || !device.state) return;
		targetPosition = initialPositiveInteger(device.state.position, 0);
		nudgeAmount = toPositiveInteger(device.state.step_size, 1);
		controlsInitialized = true;
	});

	function toOptionalNumber(value: unknown) {
		const number = Number(value);
		return value !== null && value !== undefined && Number.isFinite(number) ? number : null;
	}

	function initialPositiveInteger(value: unknown, fallback: number) {
		const number = Number(value);
		return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : fallback;
	}

	function toPositiveInteger(value: unknown, fallback: number) {
		const number = toOptionalNumber(value);
		return number !== null && number > 0 ? Math.trunc(number) : fallback;
	}

	function toOptionalPositiveInteger(value: unknown) {
		const number = toOptionalNumber(value);
		return number !== null && number > 0 ? Math.trunc(number) : undefined;
	}

	async function run(command: () => Promise<unknown>, fallbackMessage: string) {
		if (pending || !device.connected) return;
		pending = true;
		error = null;

		try {
			await command();
		} catch (err) {
			error = err instanceof Error ? err.message : fallbackMessage;
		} finally {
			pending = false;
		}
	}

	function moveAbsolute() {
		const target = Math.trunc(Number(targetPosition));
		if (!Number.isFinite(target) || target < 0 || (maxStep !== undefined && target > maxStep))
			return;
		void run(() => moveFocuser(device.id, target), 'Focuser move failed');
	}

	function nudge(direction: -1 | 1) {
		const amount = Math.trunc(Number(nudgeAmount));
		if (
			!Number.isFinite(amount) ||
			amount < 1 ||
			(maxIncrement !== undefined && amount > maxIncrement)
		)
			return;
		void run(() => nudgeFocuser(device.id, direction * amount), 'Focuser nudge failed');
	}
</script>

<DeviceShell {device} {onLifecycleComplete} showStatus={false}>
	<div class="grid gap-1.5 font-mono">
		<div class="grid grid-cols-3 gap-1.5">
			<div class="border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<span class="block text-[0.65rem] text-neutral-400 uppercase">Position</span>
				<span class="text-sm font-black">{position ?? '--'}</span>
			</div>
			<div class="border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<span class="block text-[0.65rem] text-neutral-400 uppercase">Temperature</span>
				<span class="text-sm font-black"
					>{temperature === null ? '--' : `${temperature.toFixed(1)} °C`}</span
				>
			</div>
			<div class="border border-neutral-700 bg-neutral-900 px-2 py-1.5">
				<span class="block text-[0.65rem] text-neutral-400 uppercase">Motion</span>
				<span class="text-sm font-black" class:text-purple-200={isMoving}
					>{isMoving ? 'moving' : 'idle'}</span
				>
			</div>
		</div>

		<div class="grid grid-cols-[minmax(6rem,1fr)_auto] gap-1.5">
			<label class="border border-neutral-700 bg-neutral-900 px-2 py-1">
				<span class="text-[0.65rem] text-neutral-400 uppercase">Absolute position</span>
				<input
					type="number"
					min="0"
					max={maxStep}
					step="1"
					bind:value={targetPosition}
					disabled={controlsDisabled}
					class="mt-0.5 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-0.5 text-xs font-black text-neutral-100 outline-none focus:border-[#80499c]"
				/>
			</label>
			<button
				type="button"
				disabled={controlsDisabled}
				onclick={moveAbsolute}
				class="border border-[#80499c] bg-neutral-800 px-3 text-xs font-black uppercase shadow-[2px_2px_0_#80499c] hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
				>move</button
			>
		</div>

		<div class="grid grid-cols-[auto_minmax(5rem,1fr)_auto_auto] gap-1.5">
			<button
				type="button"
				aria-label="Nudge focus inward"
				disabled={controlsDisabled}
				onclick={() => nudge(-1)}
				class="border border-[#80499c] bg-neutral-800 px-3 text-lg font-black shadow-[2px_2px_0_#80499c] disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
				>−</button
			>
			<label class="border border-neutral-700 bg-neutral-900 px-2 py-1">
				<span class="text-[0.65rem] text-neutral-400 uppercase">Nudge</span>
				<input
					type="number"
					min="1"
					max={maxIncrement}
					step={stepSize}
					bind:value={nudgeAmount}
					disabled={controlsDisabled}
					class="mt-0.5 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-0.5 text-xs font-black text-neutral-100 outline-none focus:border-[#80499c]"
				/>
			</label>
			<button
				type="button"
				aria-label="Nudge focus outward"
				disabled={controlsDisabled}
				onclick={() => nudge(1)}
				class="border border-[#80499c] bg-neutral-800 px-3 text-lg font-black shadow-[2px_2px_0_#80499c] disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
				>+</button
			>
			<button
				type="button"
				disabled={!device.connected || pending || !isMoving}
				onclick={() => void run(() => stopFocuser(device.id), 'Focuser stop failed')}
				class="border border-red-500 bg-red-950 px-2 text-xs font-black text-red-100 uppercase disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600"
				>stop</button
			>
		</div>

		{#if error}<p class="border border-red-500 bg-red-950 p-1 text-xs text-red-100">{error}</p>{/if}
	</div>
</DeviceShell>
