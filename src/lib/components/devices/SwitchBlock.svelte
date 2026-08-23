<script lang="ts">
	import { onDestroy } from 'svelte';
	import DeviceShell from './DeviceShell.svelte';
	import { setSwitchControl } from '$lib/api/observatory';
	import { displayedSwitchControlValue, switchStateControlValue } from '$lib/switchControlState.js';

	type Device = {
		id: string;
		type: string;
		name: string;
		connected: boolean;
		status?: string;
		state: Record<string, unknown> | null;
	};

	type SwitchControlType = 'toggle' | 'range';

	export type SwitchControl = {
		id: number;
		label: string;
		description?: string | null;
		writeable: boolean;
		can_async: boolean;
		control_type: SwitchControlType;
		value: boolean | number;
		key: string;
		min_value?: number;
		max_value?: number;
		step?: number;
	};

	type Props = {
		device: Device;
		controls: SwitchControl[];
		controlsError?: string | null;
		controlsLoading?: boolean;
		onLifecycleComplete?: (deviceId: string, action: 'startup' | 'shutdown') => void;
	};

	let {
		device,
		controls,
		controlsError = null,
		controlsLoading = false,
		onLifecycleComplete
	}: Props = $props();

	let pendingByControl = $state<Record<number, boolean>>({});
	let error = $state<string | null>(null);
	let localValues = $state<Record<number, number>>({});
	const localValueTimers: Record<number, ReturnType<typeof setTimeout>> = {};
	const LOCAL_VALUE_MAX_AGE_MS = 2_000;

	function valueFor(control: SwitchControl) {
		return displayedSwitchControlValue(device.state, control, localValues);
	}

	function isPending(control: SwitchControl) {
		return pendingByControl[control.id] === true;
	}

	function clamp(control: SwitchControl, value: number) {
		const min = control.min_value ?? 0;
		const max = control.max_value ?? 1;
		const cleanValue = Number.isFinite(value) ? value : min;

		return Math.max(min, Math.min(max, cleanValue));
	}

	function retainLocalValue(controlId: number, value: number) {
		const existingTimer = localValueTimers[controlId];
		if (existingTimer) clearTimeout(existingTimer);

		localValues = { ...localValues, [controlId]: value };
		localValueTimers[controlId] = setTimeout(() => {
			const nextLocalValues = { ...localValues };
			delete nextLocalValues[controlId];
			localValues = nextLocalValues;
			delete localValueTimers[controlId];
		}, LOCAL_VALUE_MAX_AGE_MS);
	}

	async function setControl(control: SwitchControl, value: number) {
		if (!device.connected || isPending(control) || !control.writeable) return;

		const next = control.control_type === 'toggle' ? (value > 0 ? 1 : 0) : clamp(control, value);

		pendingByControl = { ...pendingByControl, [control.id]: true };
		error = null;

		try {
			await setSwitchControl(device.id, control.id, next);
			retainLocalValue(control.id, next);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to set switch';
		} finally {
			const nextPending = { ...pendingByControl };
			delete nextPending[control.id];
			pendingByControl = nextPending;
		}
	}

	$effect(() => {
		if (!device.connected) {
			for (const timer of Object.values(localValueTimers)) clearTimeout(timer);
			for (const controlId of Object.keys(localValueTimers)) {
				delete localValueTimers[Number(controlId)];
			}
			localValues = {};
			return;
		}

		const nextLocalValues = { ...localValues };
		let changed = false;

		for (const [rawId, localValue] of Object.entries(localValues)) {
			const controlId = Number(rawId);
			const control = controls.find(({ id }) => id === controlId);
			if (!control || switchStateControlValue(device.state, control) === localValue) {
				delete nextLocalValues[controlId];
				const timer = localValueTimers[controlId];
				if (timer) clearTimeout(timer);
				delete localValueTimers[controlId];
				changed = true;
			}
		}

		if (changed) localValues = nextLocalValues;
	});

	onDestroy(() => {
		for (const timer of Object.values(localValueTimers)) clearTimeout(timer);
	});
</script>

<DeviceShell {device} {onLifecycleComplete} showStatus={false}>
	<div class="grid gap-1.5">
		{#if !device.connected}
			<div class="border border-dashed border-neutral-700 p-1.5 font-mono text-xs text-neutral-500">
				Connect switch device to load controls.
			</div>
		{:else if controlsLoading}
			<div class="border border-dashed border-neutral-700 p-1.5 font-mono text-xs text-neutral-500">
				Loading switch controls.
			</div>
		{:else if controlsError}
			<div class="border border-red-500 bg-red-950 p-1.5 font-mono text-xs text-red-100">
				{controlsError}
			</div>
		{:else if controls.length === 0}
			<div class="border border-dashed border-neutral-700 p-1.5 font-mono text-xs text-neutral-500">
				No switch controls reported.
			</div>
		{:else}
			<div class="grid max-h-full grid-cols-[repeat(3,max-content)] gap-1.5 overflow-y-auto pr-1">
				{#each controls as control (control.id)}
					{@const value = valueFor(control)}
					{@const active = value > 0}

					{#if control.control_type === 'toggle'}
						<button
							type="button"
							disabled={isPending(control) || !control.writeable}
							onclick={() => setControl(control, active ? 0 : 1)}
							class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border px-2 py-1.5 text-left font-mono text-xs font-black uppercase shadow-[2px_2px_0_#80499c] hover:bg-neutral-700 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600"
							class:border-[#80499c]={active}
							class:bg-[#80499c]={active}
							class:text-neutral-50={active}
							class:border-neutral-600={!active}
							class:bg-neutral-800={!active}
							class:text-neutral-100={!active}
						>
							<span class="truncate">{control.label}</span>
							<span class="border border-current px-1.5 py-0.5 text-[0.6rem] leading-none">
								{isPending(control) ? '...' : active ? 'on' : 'off'}
							</span>
						</button>
					{:else}
						<div
							class="grid min-w-0 content-center gap-1.5 border border-neutral-700 bg-neutral-950 p-1.5 font-mono shadow-[2px_2px_0_#80499c]"
						>
							<div class="grid grid-cols-[minmax(0,1fr)_4rem_auto] items-center gap-1.5">
								<p class="truncate text-xs font-black uppercase">{control.label}</p>

								<input
									type="number"
									min={control.min_value ?? 0}
									max={control.max_value ?? 1}
									step={control.step ?? 1}
									{value}
									disabled={isPending(control) || !control.writeable}
									onchange={(event) => setControl(control, Number(event.currentTarget.value))}
									class="w-full border border-neutral-600 bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
								/>

								<button
									type="button"
									disabled={isPending(control) || !control.writeable}
									onclick={() => setControl(control, value)}
									class="border border-[#80499c] bg-neutral-800 px-2 py-1 text-xs font-black uppercase shadow-[2px_2px_0_#80499c] hover:bg-neutral-700 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
								>
									set
								</button>
							</div>

							<input
								type="range"
								min={control.min_value ?? 0}
								max={control.max_value ?? 1}
								step={control.step ?? 1}
								{value}
								disabled={isPending(control) || !control.writeable}
								onchange={(event) => setControl(control, Number(event.currentTarget.value))}
								class="h-4 w-full accent-[#80499c] disabled:opacity-40"
							/>
						</div>
					{/if}
				{/each}
			</div>
		{/if}

		{#if error}
			<p class="border border-red-500 bg-red-950 p-1 font-mono text-xs text-red-100">
				{error}
			</p>
		{/if}
	</div>
</DeviceShell>
