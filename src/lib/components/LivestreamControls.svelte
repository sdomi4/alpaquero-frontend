<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		getLivestreamCameraSettings,
		listLivestreams,
		normalizeLivestreamNames,
		startLivestream,
		stopLivestream,
		updateLivestreamCameraSettings
	} from '$lib/api/livestreamRequests.js';

	type LivestreamStatus = 'unknown' | 'running' | 'stopped';
	type LivestreamResponse = { running?: unknown } | null;
	type CameraControl = 'exposure' | 'gain' | 'cooler_on' | 'target_temp' | 'flip';
	type Props = {
		initialLivestreams?: Record<string, string> | null;
		onAvailabilityChange?: (available: boolean) => void;
	};

	let { initialLivestreams, onAvailabilityChange }: Props = $props();
	const initialCatalog = untrack(() => initialLivestreams);
	const initialNames =
		initialCatalog === null
			? null
			: initialCatalog === undefined
				? []
				: normalizeLivestreamNames(initialCatalog);

	let livestreams = $state<string[] | null>(initialNames);
	let selectedName = $state(initialNames?.[0] ?? '');
	let statuses = $state<Record<string, LivestreamStatus>>({});
	let loading = $state(initialCatalog === undefined);
	let pendingAction = $state<'start' | 'stop' | null>(null);
	let error = $state<string | null>(null);
	let exposure = $state(1000);
	let gain = $state(0);
	let coolerOn = $state(false);
	let targetTemperature = $state(-10);
	let flip = $state<0 | 1 | 2 | 3>(0);
	let cameraSettingsLoading = $state((initialNames?.length ?? 0) > 0);
	let pendingCameraControl = $state<CameraControl | null>(null);
	let cameraSettingsError = $state<string | null>(null);
	let cameraSettingsRequestId = 0;

	const selectedStatus = $derived(statuses[selectedName] ?? 'unknown');
	const exposureSliderMax = $derived(Math.max(1_000_000, exposure));
	const gainSliderMax = $derived(Math.max(600, gain));

	$effect(() => {
		const name = selectedName;
		if (!name) return;

		void loadCameraSettings(name);
	});

	onMount(() => {
		if (initialCatalog === undefined) void loadLivestreams();
	});

	async function loadLivestreams() {
		loading = true;
		error = null;

		try {
			livestreams = await listLivestreams();
			onAvailabilityChange?.(livestreams !== null);

			if (livestreams !== null && !livestreams.includes(selectedName)) {
				selectedName = livestreams[0] ?? '';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load livestreams';
		} finally {
			loading = false;
		}
	}

	async function runAction(action: 'start' | 'stop') {
		if (!selectedName || pendingAction) return;

		pendingAction = action;
		error = null;

		try {
			const response = (
				action === 'start'
					? await startLivestream(selectedName)
					: await stopLivestream(selectedName)
			) as LivestreamResponse;
			const running =
				typeof response?.running === 'boolean' ? response.running : action === 'start';

			statuses = {
				...statuses,
				[selectedName]: running ? 'running' : 'stopped'
			};
		} catch (err) {
			error = err instanceof Error ? err.message : `Failed to ${action} livestream`;
		} finally {
			pendingAction = null;
		}
	}

	function cameraControlsFrom(payload: unknown) {
		if (!payload || typeof payload !== 'object') return null;

		const record = payload as Record<string, unknown>;
		const settings =
			record.camera_settings && typeof record.camera_settings === 'object'
				? (record.camera_settings as Record<string, unknown>)
				: record;
		const controls = settings.controls;

		return controls && typeof controls === 'object' ? (controls as Record<string, unknown>) : null;
	}

	function applyCameraSettings(payload: unknown) {
		const controls = cameraControlsFrom(payload);
		if (!controls) return;

		const nextExposure = Number(controls.exposure);
		const nextGain = Number(controls.gain);
		const nextCoolerOn = Number(controls.cooler_on);
		const nextTargetTemperature = Number(controls.target_temp);
		const nextFlip = Number(controls.flip);

		if (Number.isFinite(nextExposure)) exposure = Math.max(1, Math.round(nextExposure));
		if (Number.isFinite(nextGain)) gain = Math.max(0, Math.round(nextGain));
		if (nextCoolerOn === 0 || nextCoolerOn === 1) coolerOn = nextCoolerOn === 1;
		if (Number.isFinite(nextTargetTemperature)) {
			targetTemperature = Math.round(nextTargetTemperature);
		}
		if (nextFlip === 0 || nextFlip === 1 || nextFlip === 2 || nextFlip === 3) {
			flip = nextFlip;
		}
	}

	async function loadCameraSettings(name: string) {
		const requestId = ++cameraSettingsRequestId;
		cameraSettingsLoading = true;
		cameraSettingsError = null;

		try {
			const settings = await getLivestreamCameraSettings(name);

			if (requestId === cameraSettingsRequestId && name === selectedName) {
				applyCameraSettings(settings);
			}
		} catch (err) {
			if (requestId === cameraSettingsRequestId && name === selectedName) {
				cameraSettingsError = err instanceof Error ? err.message : 'Failed to load camera settings';
			}
		} finally {
			if (requestId === cameraSettingsRequestId) cameraSettingsLoading = false;
		}
	}

	async function setCameraControl(control: CameraControl) {
		if (!selectedName || pendingCameraControl) return;

		const value = cameraControlValue(control);
		applyLocalCameraControl(control, value);

		pendingCameraControl = control;
		cameraSettingsError = null;

		try {
			const settings = await updateLivestreamCameraSettings(selectedName, {
				controls: { [control]: value }
			});
			applyCameraSettings(settings);
		} catch (err) {
			cameraSettingsError = err instanceof Error ? err.message : `Failed to set camera ${control}`;
		} finally {
			pendingCameraControl = null;
		}
	}

	function finiteInteger(value: number, fallback: number) {
		return Math.round(Number.isFinite(value) ? value : fallback);
	}

	function cameraControlValue(control: CameraControl) {
		switch (control) {
			case 'exposure':
				return Math.max(1, finiteInteger(exposure, 1000));
			case 'gain':
				return Math.max(0, finiteInteger(gain, 0));
			case 'cooler_on':
				return coolerOn ? 1 : 0;
			case 'target_temp':
				return finiteInteger(targetTemperature, -10);
			case 'flip':
				return flip;
		}
	}

	function applyLocalCameraControl(control: CameraControl, value: number) {
		switch (control) {
			case 'exposure':
				exposure = value;
				break;
			case 'gain':
				gain = value;
				break;
			case 'cooler_on':
				coolerOn = value === 1;
				break;
			case 'target_temp':
				targetTemperature = value;
				break;
			case 'flip':
				flip = value as 0 | 1 | 2 | 3;
				break;
		}
	}
</script>

{#if livestreams !== null}
	<article
		class="flex h-full max-h-full w-full min-w-72 flex-col justify-self-start border border-neutral-700 bg-neutral-950 p-1.5 shadow-[2px_2px_0_#80499c]"
	>
		<header class="mb-1.5 flex items-center justify-between gap-2">
			<h3 class="truncate text-xs leading-tight font-black uppercase">Livestreams</h3>
			{#if livestreams.length > 0}
				<span
					class="shrink-0 border px-1.5 py-0.5 font-mono text-[0.6rem] leading-none font-black uppercase"
					class:border-emerald-500={selectedStatus === 'running'}
					class:bg-emerald-950={selectedStatus === 'running'}
					class:text-emerald-100={selectedStatus === 'running'}
					class:border-neutral-700={selectedStatus !== 'running'}
					class:bg-neutral-900={selectedStatus !== 'running'}
					class:text-purple-200={selectedStatus !== 'running'}
					aria-live="polite"
				>
					{selectedStatus}
				</span>
			{/if}
		</header>

		<div
			class="grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto pr-1 font-mono text-[0.65rem] uppercase"
		>
			{#if loading}
				<p class="border border-neutral-700 bg-neutral-900 p-2 text-neutral-500">Loading...</p>
			{:else if livestreams.length === 0}
				<p class="border border-dashed border-neutral-700 bg-neutral-900 p-2 text-neutral-500">
					{error ? 'Unavailable' : 'None configured'}
				</p>
				{#if error}
					<button
						type="button"
						onclick={loadLivestreams}
						class="border border-neutral-600 bg-neutral-900 px-2 py-1.5 font-black text-neutral-300 hover:bg-neutral-800"
					>
						Retry
					</button>
				{/if}
			{:else}
				<label class="grid gap-0.5">
					<span class="text-neutral-400">Preview stream</span>
					<select
						bind:value={selectedName}
						disabled={pendingAction !== null || pendingCameraControl !== null}
						class="w-full border border-neutral-600 bg-neutral-900 px-2 py-1.5 font-black text-neutral-100 disabled:cursor-wait disabled:text-neutral-500"
					>
						{#each livestreams as livestream (livestream)}
							<option value={livestream}>{livestream}</option>
						{/each}
					</select>
				</label>

				<div class="grid grid-cols-2 gap-1.5">
					<button
						type="button"
						disabled={pendingAction !== null || selectedStatus === 'running'}
						onclick={() => runAction('start')}
						class="border border-emerald-500 bg-emerald-950 px-2 py-1.5 font-black text-emerald-100 shadow-[2px_2px_0_#80499c] transition-transform hover:bg-emerald-900 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
					>
						{pendingAction === 'start' ? 'Starting...' : 'Start'}
					</button>

					<button
						type="button"
						disabled={pendingAction !== null || selectedStatus === 'stopped'}
						onclick={() => runAction('stop')}
						class="border border-yellow-400 bg-yellow-950 px-2 py-1.5 font-black text-yellow-100 shadow-[2px_2px_0_#80499c] transition-transform hover:bg-yellow-900 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
					>
						{pendingAction === 'stop' ? 'Stopping...' : 'Stop'}
					</button>
				</div>

				<div class="grid gap-1.5 border-t border-neutral-700 pt-1.5">
					<div class="flex items-center justify-between gap-2">
						<span class="font-black text-neutral-300">Camera settings</span>
						{#if cameraSettingsLoading}
							<span class="text-neutral-500">Loading...</span>
						{/if}
					</div>

					<label class="grid grid-cols-[4.5rem_minmax(6rem,1fr)_5.5rem_auto] items-center gap-1.5">
						<span class="text-neutral-400">Exposure us</span>
						<input
							type="range"
							min="1"
							max={exposureSliderMax}
							step="1"
							bind:value={exposure}
							disabled={cameraSettingsLoading || pendingCameraControl !== null}
							class="min-w-0 accent-[#80499c] disabled:opacity-50"
						/>
						<input
							type="number"
							min="1"
							step="1"
							bind:value={exposure}
							disabled={cameraSettingsLoading || pendingCameraControl !== null}
							class="w-full border border-neutral-600 bg-neutral-900 px-1.5 py-1 text-right font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
						/>
						<button
							type="button"
							onclick={() => setCameraControl('exposure')}
							disabled={cameraSettingsLoading || pendingCameraControl !== null}
							class="border border-[#80499c] bg-neutral-800 px-2 py-1 font-black text-neutral-100 shadow-[1px_1px_0_#80499c] hover:bg-neutral-700 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
						>
							{pendingCameraControl === 'exposure' ? '...' : 'Set'}
						</button>
					</label>

					<label class="grid grid-cols-[4.5rem_minmax(6rem,1fr)_5.5rem_auto] items-center gap-1.5">
						<span class="text-neutral-400">Gain</span>
						<input
							type="range"
							min="0"
							max={gainSliderMax}
							step="1"
							bind:value={gain}
							disabled={cameraSettingsLoading || pendingCameraControl !== null}
							class="min-w-0 accent-[#80499c] disabled:opacity-50"
						/>
						<input
							type="number"
							min="0"
							step="1"
							bind:value={gain}
							disabled={cameraSettingsLoading || pendingCameraControl !== null}
							class="w-full border border-neutral-600 bg-neutral-900 px-1.5 py-1 text-right font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
						/>
						<button
							type="button"
							onclick={() => setCameraControl('gain')}
							disabled={cameraSettingsLoading || pendingCameraControl !== null}
							class="border border-[#80499c] bg-neutral-800 px-2 py-1 font-black text-neutral-100 shadow-[1px_1px_0_#80499c] hover:bg-neutral-700 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
						>
							{pendingCameraControl === 'gain' ? '...' : 'Set'}
						</button>
					</label>

					<div class="grid grid-cols-[4.5rem_minmax(6rem,1fr)_auto] items-center gap-1.5">
						<span class="text-neutral-400">Cooler</span>
						<label
							class="flex cursor-pointer items-center justify-between gap-2 border border-neutral-600 bg-neutral-900 px-2 py-1"
						>
							<span class="font-black text-neutral-100">{coolerOn ? 'Enabled' : 'Disabled'}</span>
							<input
								type="checkbox"
								bind:checked={coolerOn}
								disabled={cameraSettingsLoading || pendingCameraControl !== null}
								class="size-4 accent-[#80499c]"
							/>
						</label>
						<button
							type="button"
							onclick={() => setCameraControl('cooler_on')}
							disabled={cameraSettingsLoading || pendingCameraControl !== null}
							class="border border-[#80499c] bg-neutral-800 px-2 py-1 font-black text-neutral-100 shadow-[1px_1px_0_#80499c] hover:bg-neutral-700 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
						>
							{pendingCameraControl === 'cooler_on' ? '...' : 'Set'}
						</button>
					</div>

					<label class="grid grid-cols-[4.5rem_minmax(6rem,1fr)_auto] items-center gap-1.5">
						<span class="text-neutral-400">Target C</span>
						<input
							type="number"
							step="1"
							bind:value={targetTemperature}
							disabled={cameraSettingsLoading || pendingCameraControl !== null}
							class="w-full border border-neutral-600 bg-neutral-900 px-1.5 py-1 text-right font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
						/>
						<button
							type="button"
							onclick={() => setCameraControl('target_temp')}
							disabled={cameraSettingsLoading || pendingCameraControl !== null}
							class="border border-[#80499c] bg-neutral-800 px-2 py-1 font-black text-neutral-100 shadow-[1px_1px_0_#80499c] hover:bg-neutral-700 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
						>
							{pendingCameraControl === 'target_temp' ? '...' : 'Set'}
						</button>
					</label>

					<label class="grid grid-cols-[4.5rem_minmax(6rem,1fr)_auto] items-center gap-1.5">
						<span class="text-neutral-400">Flip</span>
						<select
							bind:value={flip}
							disabled={cameraSettingsLoading || pendingCameraControl !== null}
							class="w-full border border-neutral-600 bg-neutral-900 px-1.5 py-1 font-black text-neutral-100 outline-none focus:border-[#80499c] disabled:text-neutral-600"
						>
							<option value={0}>No flip</option>
							<option value={1}>Horizontal</option>
							<option value={2}>Vertical</option>
							<option value={3}>Horizontal + vertical</option>
						</select>
						<button
							type="button"
							onclick={() => setCameraControl('flip')}
							disabled={cameraSettingsLoading || pendingCameraControl !== null}
							class="border border-[#80499c] bg-neutral-800 px-2 py-1 font-black text-neutral-100 shadow-[1px_1px_0_#80499c] hover:bg-neutral-700 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
						>
							{pendingCameraControl === 'flip' ? '...' : 'Set'}
						</button>
					</label>
				</div>
			{/if}

			{#if error && livestreams.length > 0}
				<p class="truncate border border-red-500 bg-red-950 p-1 text-red-100" title={error}>
					{error}
				</p>
			{/if}

			{#if cameraSettingsError && livestreams.length > 0}
				<p
					class="truncate border border-red-500 bg-red-950 p-1 text-red-100"
					title={cameraSettingsError}
				>
					{cameraSettingsError}
				</p>
			{/if}
		</div>
	</article>
{/if}
