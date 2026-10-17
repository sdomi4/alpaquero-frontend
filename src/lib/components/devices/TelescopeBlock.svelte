<script lang="ts">
	import DeviceShell from './DeviceShell.svelte';
	import {
		lookupStar,
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

	let targetRa = $state('');
	let targetName = $state('');
	let lookingUp = $state(false);
	let targetDec = $state('');
	let safetyOverride = $state(false);
	let pending = $state<TelescopeAction | null>(null);
	let error = $state<string | null>(null);
	let targetsInitialized = $state(false);

	const displayState = $derived(getTelescopeDisplayState(device.state));
	const canCommand = $derived(device.connected && pending === null && !lookingUp);

	async function lookupTarget(event: SubmitEvent) {
		event.preventDefault();
		if (!targetName.trim() || lookingUp || pending !== null) return;
		lookingUp = true;
		error = null;
		try {
			const result = await lookupStar(targetName);
			targetsInitialized = true;
			targetRa = String(result.ra);
			targetDec = String(result.dec);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Star lookup failed';
		} finally {
			lookingUp = false;
		}
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
				const result = await slewTelescope(device.id, targetRa, targetDec, safetyOverride);
				targetRa = result.ra;
				targetDec = result.dec;
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
	<div class="flex h-full w-[26rem] flex-col gap-1 pb-0.5">
		<div
			class="telescope-state grid min-h-10 flex-[0.65] grid-cols-[1fr_1.3fr_0.95fr] grid-rows-2 gap-1 font-mono"
		>
			<div
				class="flex min-w-0 items-center justify-between gap-1 border border-emerald-400/50 bg-emerald-400/5 px-1.5 py-0.5"
			>
				<p class="shrink-0 text-[0.6rem] leading-none text-emerald-300 uppercase">RA</p>
				<p class="truncate text-xs leading-none font-black">
					{displayState.positionRa ?? '--'}
				</p>
			</div>

			<div
				class="flex min-w-0 items-center justify-between gap-1 border border-[#80499c] bg-[#80499c]/10 px-1.5 py-0.5"
			>
				<p class="shrink-0 text-[0.6rem] leading-none text-purple-200 uppercase">Target RA</p>
				<p class="truncate text-xs leading-none font-black">
					{displayState.targetRa ?? '--'}
				</p>
			</div>

			<div
				class="flex min-w-0 items-center justify-between gap-1 border bg-neutral-900 px-1.5 py-0.5"
				class:border-yellow-300={displayState.slewing === true}
				class:border-neutral-700={displayState.slewing !== true}
			>
				<p class="shrink-0 text-[0.6rem] leading-none text-neutral-400 uppercase">Motion</p>
				<p class="truncate text-xs leading-none font-black uppercase">
					{displayState.slewing === true
						? 'slewing'
						: formatBoolean(displayState.tracking, 'tracking', 'idle')}
				</p>
			</div>

			<div
				class="flex min-w-0 items-center justify-between gap-1 border border-emerald-400/50 bg-emerald-400/5 px-1.5 py-0.5"
			>
				<p class="shrink-0 text-[0.6rem] leading-none text-emerald-300 uppercase">Dec</p>
				<p class="truncate text-xs leading-none font-black">
					{displayState.positionDec ?? '--'}
				</p>
			</div>

			<div
				class="flex min-w-0 items-center justify-between gap-1 border border-[#80499c] bg-[#80499c]/10 px-1.5 py-0.5"
			>
				<p class="shrink-0 text-[0.6rem] leading-none text-purple-200 uppercase">Target Dec</p>
				<p class="truncate text-xs leading-none font-black">
					{displayState.targetDec ?? '--'}
				</p>
			</div>

			<div
				class="flex min-w-0 items-center justify-between gap-1 border bg-neutral-900 px-1.5 py-0.5"
				class:border-emerald-400={displayState.parked === true}
				class:border-neutral-700={displayState.parked !== true}
			>
				<p class="shrink-0 text-[0.6rem] leading-none text-neutral-400 uppercase">Park</p>
				<p class="truncate text-xs leading-none font-black uppercase">
					{formatBoolean(displayState.parked, 'parked', 'free')}
				</p>
			</div>
		</div>

		<div
			class="telescope-controls grid min-h-[4.625rem] flex-1 grid-cols-[minmax(0,1fr)_auto] items-stretch gap-1 font-mono"
		>
			<div class="grid min-h-0 min-w-0 grid-rows-3 gap-1">
				<form onsubmit={lookupTarget} class="flex min-h-0 items-stretch gap-1">
					<label class="min-h-0 min-w-0 flex-1">
						<span class="sr-only">Star name</span>
						<input
							type="text"
							placeholder="Star name"
							bind:value={targetName}
							disabled={lookingUp || pending !== null}
							class="block h-full min-h-0 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-0.5 text-xs font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
						/>
					</label>
					<button
						type="submit"
						disabled={!targetName.trim() || lookingUp || pending !== null}
						class="border border-[#80499c] bg-neutral-800 px-2 py-0.5 text-xs font-black text-neutral-100 uppercase hover:bg-neutral-700 disabled:cursor-not-allowed disabled:text-neutral-600"
					>
						{lookingUp ? 'looking up' : 'lookup'}
					</button>
				</form>
				<div class="grid min-h-0 grid-cols-2 gap-1">
					<label class="min-h-0 min-w-0">
						<span class="sr-only">Command RA</span>
						<input
							type="text"
							placeholder="RA hh:mm:ss.ss"
							bind:value={targetRa}
							oninput={() => {
								targetsInitialized = true;
							}}
							disabled={!canCommand}
							class="block h-full min-h-0 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-0.5 text-xs font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
						/>
					</label>

					<label class="min-h-0 min-w-0">
						<span class="sr-only">Command Dec</span>
						<input
							type="text"
							placeholder="Dec +dd:mm:ss.ss"
							bind:value={targetDec}
							oninput={() => {
								targetsInitialized = true;
							}}
							disabled={!canCommand}
							class="block h-full min-h-0 w-full border border-neutral-600 bg-neutral-950 px-1.5 py-0.5 text-xs font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
						/>
					</label>
				</div>
				<label
					class="flex cursor-pointer items-center justify-between gap-3 border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[0.65rem]"
					class:border-red-500={safetyOverride}
					title="Bypass safety checks for telescope commands"
				>
					<span class="text-neutral-300 uppercase">Safe</span>
					<input type="checkbox" bind:checked={safetyOverride} class="h-4 w-4 accent-red-600" />
				</label>
			</div>

			<div class="grid min-h-0 grid-cols-2 grid-rows-2 gap-1">
				<button
					type="button"
					disabled={!canCommand}
					onclick={() => run('slew')}
					class="min-w-20 border border-[#80499c] bg-neutral-800 px-3 py-1 text-xs font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] hover:bg-neutral-700 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600"
				>
					{pending === 'slew' ? 'slewing' : 'slew'}
				</button>

				<button
					type="button"
					disabled={!canCommand}
					onclick={() => run('sun')}
					class="min-w-20 border border-yellow-300 bg-yellow-950 px-3 py-1 text-xs font-black text-yellow-100 uppercase shadow-[2px_2px_0_#80499c] hover:bg-yellow-900 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600"
				>
					{pending === 'sun' ? 'slewing' : 'sun'}
				</button>

				<button
					type="button"
					disabled={!canCommand || displayState.parked === true}
					onclick={() => run('park')}
					class="min-w-20 border border-[#80499c] bg-neutral-800 px-3 py-1 text-xs font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] hover:bg-neutral-700 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600"
				>
					{pending === 'park' ? 'parking' : 'park'}
				</button>

				<button
					type="button"
					disabled={!canCommand || displayState.parked === false}
					onclick={() => run('unpark')}
					class="min-w-20 border border-[#80499c] bg-neutral-800 px-3 py-1 text-xs font-black text-neutral-100 uppercase shadow-[2px_2px_0_#80499c] hover:bg-neutral-700 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600"
				>
					{pending === 'unpark' ? 'freeing' : 'unpark'}
				</button>
			</div>
		</div>

		{#if error}
			<p
				class="min-w-0 border border-red-500 bg-red-950 p-1 font-mono text-xs break-words text-red-100"
			>
				{error}
			</p>
		{/if}
	</div>
</DeviceShell>
