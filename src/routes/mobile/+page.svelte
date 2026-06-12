<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_WS_BASE } from '$env/static/public';
	import type { PageData } from './$types';
	import CameraFeed from '$lib/components/CameraFeed.svelte';
	import ErrorToast from '$lib/components/ErrorToast.svelte';
	import CameraBlock from '$lib/components/devices/CameraBlock.svelte';
	import GenericDeviceBlock from '$lib/components/devices/GenericDeviceBlock.svelte';
	import FilterWheelBlock from '$lib/components/devices/FilterWheelBlock.svelte';
	import TelescopeBlock from '$lib/components/devices/TelescopeBlock.svelte';
	import ObservingConditionsBlock from '$lib/components/devices/ObservingConditionsBlock.svelte';
	import SequencePanel from '$lib/components/sequences/SequencePanel.svelte';
	import DomeBlock from '$lib/components/devices/DomeBlock.svelte';
	import CoverBlock from '$lib/components/devices/CoverBlock.svelte';
	import SwitchBlock from '$lib/components/devices/SwitchBlock.svelte';
	import type { SwitchControl } from '$lib/components/devices/SwitchBlock.svelte';
	import WebsocketLogger from '$lib/components/WebsocketLogger.svelte';
	import { getSwitchControls, runObservatoryAction, runSequence } from '$lib/api/observatory';
	import type { ObservatoryAction } from '$lib/api/observatory';
	import { runObservatoryControlAction } from '$lib/observatoryControlActions.js';
	import { createCameraDeviceFeeds, createConfiguredCameraFeeds } from '$lib/cameraFeeds.js';
	import {
		createMobileControlOptions,
		getControlDevices,
		mergeConfiguredDevices
	} from '$lib/controlModel.js';
	import { parseObservatoryLogMessage } from '$lib/websocketMessages';

	let { data }: { data: PageData } = $props();

	type DeviceState = {
		id: string;
		type?: string;
		name?: string | null;
		connected: boolean;
		status?: string;
		state: Record<string, unknown>;
	};

	type MergedDevice = {
		id: string;
		type: string;
		name: string;
		connected: boolean;
		status: string;
		state: Record<string, unknown> | null;
		live?: DeviceState;
	};

	type ActiveSequence = {
		context_id: string;
		sequence_name: string;
		status: string;
	};

	type LogMessage = {
		id: string;
		level: string;
		message: string;
		timestamp: string;
		receivedAt: string;
		raw: string;
	};

	type ObservatoryStateStatus = {
		status?: unknown;
		actions?: unknown[];
		messages?: Record<string, unknown>;
	};

	let liveSequences = $state<Record<string, ActiveSequence>>({});
	let liveDevices = $state<Record<string, DeviceState>>({});
	let wsStatus = $state<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
	let errorWsStatus = $state<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
	let websocketMessages = $state<LogMessage[]>([]);
	let latestErrorMessage = $state<LogMessage | null>(null);
	let websocketMessageCounter = 0;
	let observatoryName = $state('Observatory');
	let backendObservatoryStatus = $state('');
	let observatoryStateStatus = $state<ObservatoryStateStatus | null>(null);
	let selectedControlId = $state('sequences');
	let switchControlsByDevice = $state<Record<string, SwitchControl[]>>({});
	let switchControlLoadStatus = $state<Record<string, 'loading' | 'loaded' | 'error'>>({});
	let switchControlErrors = $state<Record<string, string | null>>({});
	let observatoryActionPending = $state<ObservatoryAction | null>(null);
	let observatoryActionError = $state<string | null>(null);

	const OBSERVATORY_ACTIONS: Array<{
		action: ObservatoryAction;
		title: string;
		tone: 'start' | 'stop' | 'halt';
	}> = [
		{ action: 'startup', title: 'Startup observatory', tone: 'start' },
		{ action: 'shutdown', title: 'Shutdown observatory', tone: 'stop' },
		{ action: 'emergency_halt', title: 'Emergency halt', tone: 'halt' }
	];

	const mergedDevices: MergedDevice[] = $derived(
		mergeConfiguredDevices(data.devices, liveDevices) as MergedDevice[]
	);
	const cameraFeeds = $derived.by(() => {
		const backendCameraFeeds = createConfiguredCameraFeeds(data.cameras);
		return backendCameraFeeds.length > 0
			? backendCameraFeeds
			: createCameraDeviceFeeds(data.devices);
	});
	const safetyMonitorDevice = $derived(
		mergedDevices.find((device) => device.type === 'safety_monitor') ?? null
	);
	const observingConditionsDevice = $derived(
		mergedDevices.find((device) => device.type === 'observing_conditions') ?? null
	);
	const controlDevices = $derived(getControlDevices(mergedDevices) as MergedDevice[]);
	const switchDevices = $derived(controlDevices.filter((device) => device.type === 'switch'));
	const controlOptions = $derived(createMobileControlOptions(controlDevices));
	const selectedControl = $derived(
		controlOptions.find((option) => option.id === selectedControlId) ?? controlOptions[0] ?? null
	);
	const selectedDevice = $derived(
		selectedControl?.kind === 'device'
			? (controlDevices.find((device) => device.id === selectedControl.deviceId) ?? null)
			: null
	);
	const observatoryStatus = $derived(
		backendObservatoryStatus ||
			(typeof observatoryStateStatus?.status === 'string' && observatoryStateStatus.status.trim()
				? observatoryStateStatus.status.trim()
				: '') ||
			wsStatus
	);
	const observatoryStateMessage = $derived(formatStatusMessages(observatoryStateStatus?.messages));
	const safetyStatus = $derived(formatSafetyStatus(safetyMonitorDevice));
	const safetyState = $derived(getSafetyState(safetyMonitorDevice, safetyStatus));

	$effect(() => {
		if (!controlOptions.some((option) => option.id === selectedControlId)) {
			selectedControlId = controlOptions[0]?.id ?? '';
		}
	});

	$effect(() => {
		for (const device of switchDevices) {
			if (!device.connected) continue;
			if (normalizeSwitchControls(device.state?.controls).length > 0) continue;
			if (switchControlLoadStatus[device.id]) continue;
			void loadSwitchControls(device.id);
		}
	});

	function handleLifecycleComplete(deviceId: string, action: 'startup' | 'shutdown') {
		if (action !== 'shutdown') return;

		const next = { ...liveDevices };
		delete next[deviceId];
		liveDevices = next;
	}

	async function handleObservatoryAction(action: ObservatoryAction) {
		if (observatoryActionPending) return;

		observatoryActionPending = action;
		observatoryActionError = null;

		try {
			await runObservatoryControlAction(action, { runSequence, runObservatoryAction });
		} catch (err) {
			observatoryActionError = err instanceof Error ? err.message : 'Observatory action failed';
		} finally {
			observatoryActionPending = null;
		}
	}

	function appendWebsocketMessage(raw: string) {
		const parsed = parseObservatoryLogMessage(raw);
		const message = {
			...parsed,
			id: `mobile-errors-ws-${websocketMessageCounter++}`
		};

		websocketMessages = [message, ...websocketMessages].slice(0, 100);

		if (message.level.toLowerCase() === 'error') {
			latestErrorMessage = message;
		}
	}

	function dismissErrorToast() {
		latestErrorMessage = null;
	}

	function normalizeSwitchControls(raw: unknown): SwitchControl[] {
		const controls =
			raw && typeof raw === 'object' && 'controls' in raw
				? (raw as { controls?: unknown }).controls
				: raw;

		const controlList = Array.isArray(controls)
			? controls
			: controls && typeof controls === 'object'
				? Object.values(controls)
				: [];

		return controlList
			.map((control) => {
				const record = control as Record<string, unknown>;
				const id = Number(record.id ?? record.number);
				const labelValue = record.label ?? record.name ?? `Switch ${id}`;
				const controlTypeValue = record.control_type ?? record.type;
				const minValue = Number(record.min_value ?? record.min);
				const maxValue = Number(record.max_value ?? record.max);
				const value = record.value ?? record.state;

				return {
					id,
					label: String(labelValue),
					description:
						typeof record.description === 'string' || record.description === null
							? record.description
							: null,
					writeable: Boolean(record.writeable ?? record.can_write ?? true),
					can_async: Boolean(record.can_async ?? false),
					control_type:
						controlTypeValue === 'range' || Number.isFinite(minValue) || Number.isFinite(maxValue)
							? 'range'
							: 'toggle',
					value:
						typeof value === 'boolean' || typeof value === 'number'
							? value
							: Boolean(value ?? false),
					key:
						typeof record.key === 'string'
							? record.key
							: typeof record.name === 'string'
								? record.name
								: String(id),
					min_value: Number.isFinite(minValue) ? minValue : undefined,
					max_value: Number.isFinite(maxValue) ? maxValue : undefined,
					step: typeof record.step === 'number' ? record.step : undefined
				} satisfies SwitchControl;
			})
			.filter((control) => Number.isFinite(control.id));
	}

	async function loadSwitchControls(deviceId: string) {
		switchControlLoadStatus = {
			...switchControlLoadStatus,
			[deviceId]: 'loading'
		};
		switchControlErrors = {
			...switchControlErrors,
			[deviceId]: null
		};

		try {
			const controls = normalizeSwitchControls(await getSwitchControls(deviceId));

			switchControlsByDevice = {
				...switchControlsByDevice,
				[deviceId]: controls
			};
			switchControlLoadStatus = {
				...switchControlLoadStatus,
				[deviceId]: 'loaded'
			};
		} catch (err) {
			switchControlLoadStatus = {
				...switchControlLoadStatus,
				[deviceId]: 'error'
			};
			switchControlErrors = {
				...switchControlErrors,
				[deviceId]: err instanceof Error ? err.message : 'Failed to load switch controls'
			};
		}
	}

	function switchControlsForDevice(device: MergedDevice) {
		const liveControls = normalizeSwitchControls(device.state?.controls);
		return liveControls.length > 0 ? liveControls : (switchControlsByDevice[device.id] ?? []);
	}

	function switchControlsLoadingForDevice(device: MergedDevice) {
		if (normalizeSwitchControls(device.state?.controls).length > 0) return false;
		return switchControlLoadStatus[device.id] === 'loading';
	}

	function switchControlsErrorForDevice(device: MergedDevice) {
		if (normalizeSwitchControls(device.state?.controls).length > 0) return null;
		return switchControlErrors[device.id] ?? null;
	}

	function firstStringValue(source: Record<string, unknown>, keys: string[]) {
		for (const key of keys) {
			const value = source[key];

			if (typeof value === 'string' && value.trim()) return value.trim();
			if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		}

		return '';
	}

	function formatStatusMessages(messages: Record<string, unknown> | undefined): string {
		const entries = Object.entries(messages ?? {});

		if (entries.length === 0) return 'no messages';

		return entries.map(([key, value]) => `${key}: ${formatStatusMessageValue(value)}`).join(' | ');
	}

	function formatStatusMessageValue(value: unknown): string {
		if (value === null) return 'null';
		if (value === undefined) return 'unknown';
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		if (Array.isArray(value)) return value.map(formatStatusMessageValue).join(', ');

		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}

	function formatSafetyStatus(device: MergedDevice | null) {
		if (!device) return 'safety unknown';
		if (!device.connected) return 'safety offline';

		const state = device.state ?? {};
		const safeValue = state.is_safe ?? state.safe ?? state.safety_safe;

		if (typeof safeValue === 'boolean') {
			return safeValue ? 'SAFE' : 'UNSAFE';
		}

		return (
			firstStringValue(state, ['safety', 'status', 'status_text', 'message']) ||
			device.status ||
			'unknown'
		);
	}

	function getSafetyState(device: MergedDevice | null, status: string) {
		if (!device || !device.connected) return 'unknown';

		const state = device.state ?? {};
		const safeValue = state.is_safe ?? state.safe ?? state.safety_safe;

		if (typeof safeValue === 'boolean') return safeValue ? 'safe' : 'unsafe';

		const normalized = status.toLowerCase();
		if (
			normalized.includes('unsafe') ||
			normalized.includes('danger') ||
			normalized.includes('closed')
		) {
			return 'unsafe';
		}

		if (normalized.includes('safe') || normalized.includes('open')) {
			return 'safe';
		}

		return 'unknown';
	}

	function renderDevice(device: MergedDevice) {
		return {
			CameraBlock,
			FilterWheelBlock,
			TelescopeBlock,
			DomeBlock,
			CoverBlock,
			GenericDeviceBlock,
			component:
				device.type === 'camera'
					? CameraBlock
					: device.type === 'filterwheel'
						? FilterWheelBlock
						: device.type === 'telescope'
							? TelescopeBlock
							: device.type === 'dome'
								? DomeBlock
								: device.type === 'cover'
									? CoverBlock
									: GenericDeviceBlock
		}.component;
	}

	function observatoryActionLabel(action: ObservatoryAction) {
		if (action === 'startup') return 'Start';
		if (action === 'shutdown') return 'Stop';
		return 'Halt';
	}

	onMount(() => {
		const ws = new WebSocket(`${PUBLIC_WS_BASE}/ws/state`);
		const errorWs = new WebSocket(`${PUBLIC_WS_BASE}/ws/errors`);

		ws.onopen = () => {
			wsStatus = 'connected';
		};

		ws.onmessage = (event) => {
			try {
				const payload = JSON.parse(event.data) as Record<string, unknown>;
				const devices = (payload.devices ?? {}) as Record<string, unknown>;
				liveSequences = (payload.sequences ?? {}) as Record<string, ActiveSequence>;
				observatoryName =
					firstStringValue(payload, ['observatory_name', 'observatory', 'site_name', 'name']) ||
					observatoryName;
				const stateStatus =
					payload.status && typeof payload.status === 'object' && !Array.isArray(payload.status)
						? (payload.status as ObservatoryStateStatus)
						: null;
				observatoryStateStatus = stateStatus;
				backendObservatoryStatus = firstStringValue(payload, [
					'observatory_status',
					'overall_status',
					'state'
				]);

				liveDevices = Object.fromEntries(
					Object.entries(devices).map(([id, raw]) => {
						const device = raw as Record<string, unknown>;

						const { device_type, type, name, connected, status, ...state } = device;
						delete state.id;

						return [
							id,
							{
								id,
								type: String(device_type ?? type ?? ''),
								name: typeof name === 'string' ? name : null,
								connected: Boolean(connected),
								status: String(status ?? 'unknown'),
								state
							}
						];
					})
				);
			} catch (error) {
				console.error('Invalid websocket payload:', error);
				wsStatus = 'error';
			}
		};

		ws.onerror = () => {
			wsStatus = 'error';
		};

		ws.onclose = () => {
			wsStatus = 'disconnected';
		};

		errorWs.onmessage = (event) => {
			const raw = typeof event.data === 'string' ? event.data : String(event.data);
			appendWebsocketMessage(raw);
		};

		errorWs.onopen = () => {
			errorWsStatus = 'connected';
		};

		errorWs.onerror = () => {
			errorWsStatus = 'error';
		};

		errorWs.onclose = () => {
			errorWsStatus = 'disconnected';
		};

		return () => {
			ws.close();
			errorWs.close();
		};
	});
</script>

<svelte:head>
	<title>Alpaquero Mobile Control</title>
</svelte:head>

<ErrorToast message={latestErrorMessage} onDismiss={dismissErrorToast} />

<main
	class="grid h-dvh grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden bg-neutral-950 p-2 text-neutral-100"
>
	<header
		class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-2 border-neutral-700 bg-neutral-900 p-2 text-neutral-100 shadow-[4px_4px_0_#80499c]"
	>
		<div
			class="min-w-0 border border-[#80499c] bg-[#211428] px-2 py-1.5 font-mono text-xs text-purple-100 uppercase"
		>
			<p class="text-[0.6rem] leading-none font-black tracking-[0.16em]">Status</p>
			<p class="mt-1 truncate text-sm leading-none font-black">{observatoryStatus}</p>
		</div>

		<div
			class="max-w-[8.5rem] min-w-0 border-2 px-2 py-1.5 font-mono text-xs uppercase shadow-[2px_2px_0_#80499c]"
			class:border-emerald-300={safetyState === 'safe'}
			class:bg-emerald-950={safetyState === 'safe'}
			class:text-emerald-100={safetyState === 'safe'}
			class:border-red-400={safetyState === 'unsafe'}
			class:bg-red-950={safetyState === 'unsafe'}
			class:text-red-100={safetyState === 'unsafe'}
			class:border-neutral-600={safetyState === 'unknown'}
			class:bg-neutral-950={safetyState === 'unknown'}
			class:text-neutral-300={safetyState === 'unknown'}
		>
			<p class="text-[0.6rem] leading-none font-black tracking-[0.16em]">Safety</p>
			<p class="mt-1 truncate text-sm leading-none font-black">{safetyStatus}</p>
		</div>

		<div
			class="border border-[#80499c] bg-[#211428] px-2 py-1.5 font-mono text-[0.65rem] text-purple-100 uppercase"
		>
			User
		</div>
	</header>

	<section class="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
		<div class="min-h-0">
			<CameraFeed feeds={cameraFeeds} />
		</div>

		<section
			class="flex min-h-0 flex-col overflow-hidden border-2 border-neutral-700 bg-neutral-900 p-2 shadow-[4px_4px_0_#80499c]"
		>
			<div class="mb-2 grid shrink-0 gap-2 border-b-2 border-neutral-700 pb-2">
				<div class="flex min-w-0 items-center justify-between gap-2">
					<h2 class="text-base leading-none font-black uppercase">Control</h2>

					<span class="truncate font-mono text-[0.65rem] text-neutral-400 uppercase">
						{observatoryStateMessage}
					</span>
				</div>

				<select
					bind:value={selectedControlId}
					class="w-full border border-[#80499c] bg-neutral-950 px-2 py-2 font-mono text-sm font-black text-neutral-100 uppercase outline-none focus:border-purple-300"
					aria-label="Select control"
				>
					{#each controlOptions as option (option.id)}
						<option value={option.id}>{option.label}</option>
					{/each}
				</select>
			</div>

			{#if data.error}
				<p
					class="mb-2 shrink-0 border border-red-500 bg-red-950 p-2 font-mono text-xs text-red-100"
				>
					{data.error}
				</p>
			{/if}

			<div class="min-h-0 flex-1 overflow-y-auto pr-1">
				{#if selectedControl?.kind === 'sequences'}
					<SequencePanel availableSequences={data.sequences} activeSequences={liveSequences} />
				{:else if selectedControl?.kind === 'conditions'}
					<div class="h-full min-h-[10rem]">
						{#if observingConditionsDevice}
							<ObservingConditionsBlock
								device={observingConditionsDevice}
								onLifecycleComplete={handleLifecycleComplete}
							/>
						{:else}
							<section
								class="h-full border-2 border-neutral-700 bg-neutral-900 p-2 shadow-[4px_4px_0_#80499c]"
							>
								<div class="mb-2 border-b-2 border-neutral-700 pb-2">
									<h2 class="text-lg font-black uppercase">Conditions</h2>
								</div>

								<p
									class="border border-dashed border-neutral-700 p-2 font-mono text-xs text-neutral-500"
								>
									No observing conditions device configured.
								</p>
							</section>
						{/if}
					</div>
				{:else if selectedControl?.kind === 'log'}
					<div class="h-full min-h-[10rem]">
						<WebsocketLogger messages={websocketMessages} status={errorWsStatus} />
					</div>
				{:else if selectedControl?.kind === 'observatory-actions'}
					<section class="grid h-full min-h-[10rem] content-start gap-2">
						<div class="grid grid-cols-3 gap-2" aria-label="Observatory controls">
							{#each OBSERVATORY_ACTIONS as item (item.action)}
								<button
									type="button"
									title={item.title}
									disabled={observatoryActionPending !== null}
									onclick={() => handleObservatoryAction(item.action)}
									class="min-h-16 border-2 font-mono text-xs leading-none font-black uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-wait disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
									class:border-emerald-400={item.tone === 'start'}
									class:bg-emerald-950={item.tone === 'start'}
									class:text-emerald-100={item.tone === 'start'}
									class:border-yellow-300={item.tone === 'stop'}
									class:bg-yellow-950={item.tone === 'stop'}
									class:text-yellow-100={item.tone === 'stop'}
									class:border-red-400={item.tone === 'halt'}
									class:bg-red-950={item.tone === 'halt'}
									class:text-red-100={item.tone === 'halt'}
								>
									{observatoryActionPending === item.action
										? '...'
										: observatoryActionLabel(item.action)}
								</button>
							{/each}
						</div>

						{#if observatoryActionError}
							<p class="border border-red-500 bg-red-950 p-2 font-mono text-xs text-red-100">
								{observatoryActionError}
							</p>
						{/if}
					</section>
				{:else if selectedDevice}
					<div class="h-full min-h-[10rem]">
						{#if selectedDevice.type === 'switch'}
							{@const switchControls = switchControlsForDevice(selectedDevice)}

							<SwitchBlock
								device={selectedDevice}
								controls={switchControls}
								controlsLoading={switchControls.length === 0 &&
									switchControlsLoadingForDevice(selectedDevice)}
								controlsError={switchControls.length === 0
									? switchControlsErrorForDevice(selectedDevice)
									: null}
								onLifecycleComplete={handleLifecycleComplete}
							/>
						{:else}
							{@const DeviceComponent = renderDevice(selectedDevice)}

							<DeviceComponent
								device={selectedDevice}
								onLifecycleComplete={handleLifecycleComplete}
							/>
						{/if}
					</div>
				{:else}
					<p class="border border-dashed border-neutral-700 p-2 font-mono text-xs text-neutral-500">
						No configured control devices reported by backend.
					</p>
				{/if}
			</div>
		</section>
	</section>
</main>
