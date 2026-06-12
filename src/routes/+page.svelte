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
	import logo from '$lib/assets/Arriero_Logo_Mono_Clear.svg';
	import { getSwitchControls, runObservatoryAction, runSequence } from '$lib/api/observatory';
	import type { ObservatoryAction } from '$lib/api/observatory';
	import { runObservatoryControlAction } from '$lib/observatoryControlActions.js';
	import { createCameraDeviceFeeds, createConfiguredCameraFeeds } from '$lib/cameraFeeds.js';
	import { getControlDevices, mergeConfiguredDevices } from '$lib/controlModel.js';
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
	let activeControlTab = $state('');
	let switchControlsByDevice = $state<Record<string, SwitchControl[]>>({});
	let switchControlLoadStatus = $state<Record<string, 'loading' | 'loaded' | 'error'>>({});
	let switchControlErrors = $state<Record<string, string | null>>({});
	let observatoryActionPending = $state<ObservatoryAction | null>(null);
	let observatoryActionError = $state<string | null>(null);

	const DEVICE_CONTROL_GAP_PX = 8;

	let controlArea: HTMLDivElement | null = $state(null);
	let controlAreaWidth = $state(0);

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
	const observingConditionsDevice = $derived(
		mergedDevices.find((device) => device.type === 'observing_conditions') ?? null
	);
	const safetyMonitorDevice = $derived(
		mergedDevices.find((device) => device.type === 'safety_monitor') ?? null
	);
	const controlDevices = $derived(getControlDevices(mergedDevices) as MergedDevice[]);
	const switchDevices = $derived(controlDevices.filter((device) => device.type === 'switch'));
	const controlTabs = $derived(createWidthBasedControlTabs(controlDevices, controlAreaWidth));
	const activeControlTabModel = $derived(
		controlTabs.find((tab) => tab.id === activeControlTab) ?? controlTabs[0] ?? null
	);
	const activeControlDevices = $derived(activeControlTabModel?.devices ?? []);
	const showControlTabs = $derived(controlTabs.length > 1);
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
		if (!controlArea) return;

		const observer = new ResizeObserver(([entry]) => {
			controlAreaWidth = entry.contentRect.width;
		});

		observer.observe(controlArea);

		return () => observer.disconnect();
	});

	$effect(() => {
		if (!controlTabs.some((tab) => tab.id === activeControlTab)) {
			activeControlTab = controlTabs[0]?.id ?? '';
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
			id: `errors-ws-${websocketMessageCounter++}`
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

	function deviceControlFrameClass(device: MergedDevice) {
		const base = 'h-40 shrink-0 w-fit';

		if (device.type === 'camera') return `${base} min-w-40 max-w-[24rem]`;
		if (device.type === 'cover') return `${base} min-w-40 max-w-[42rem]`;
		if (device.type === 'telescope') return 'h-full shrink-0 w-fit min-w-40 max-w-[52rem]';
		if (device.type === 'filterwheel') return `${base} min-w-40 max-w-[36rem]`;
		if (device.type === 'dome') return `${base} min-w-40`;
		if (device.type === 'switch') return `${base} min-w-40 max-w-[64rem]`;

		return `${base} min-w-40 max-w-[30rem]`;
	}

	function estimatedDeviceControlWidth(device: MergedDevice) {
		if (device.type === 'dome') return 170;
		if (device.type === 'camera') return 320;
		if (device.type === 'cover') return 300;
		if (device.type === 'filterwheel') return 260;
		if (device.type === 'switch') return 420;
		if (device.type === 'telescope') return 720;

		return 240;
	}

	function createWidthBasedControlTabs(devices: MergedDevice[], availableWidth: number) {
		if (devices.length === 0) return [];

		const safeWidth = Math.max(availableWidth, 160);
		const tabs: Array<{
			id: string;
			label: string;
			devices: MergedDevice[];
			kind: 'controls' | 'switches';
		}> = [];

		let currentDevices: MergedDevice[] = [];
		let currentWidth = 0;

		for (const device of devices) {
			const deviceWidth = estimatedDeviceControlWidth(device);
			const gapWidth = currentDevices.length > 0 ? DEVICE_CONTROL_GAP_PX : 0;
			const nextWidth = currentWidth + gapWidth + deviceWidth;

			if (currentDevices.length > 0 && nextWidth > safeWidth) {
				tabs.push({
					id: `controls-${tabs.length + 1}`,
					label: `Page ${tabs.length + 1}`,
					devices: currentDevices,
					kind: 'controls'
				});

				currentDevices = [device];
				currentWidth = deviceWidth;
			} else {
				currentDevices = [...currentDevices, device];
				currentWidth = nextWidth;
			}
		}

		if (currentDevices.length > 0) {
			tabs.push({
				id: `controls-${tabs.length + 1}`,
				label: `Page ${tabs.length + 1}`,
				devices: currentDevices,
				kind: 'controls'
			});
		}

		return tabs;
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
				console.log('Received websocket message:', payload);
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

		errorWs.onopen = () => {
			errorWsStatus = 'connected';
		};

		errorWs.onmessage = (event) => {
			const raw = typeof event.data === 'string' ? event.data : String(event.data);
			appendWebsocketMessage(raw);
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
	<title>Alpaquero</title>
</svelte:head>

<ErrorToast message={latestErrorMessage} onDismiss={dismissErrorToast} />

<main
	class="grid h-screen grid-rows-[auto_minmax(0,1fr)_minmax(14.5rem,0.64fr)] gap-2 overflow-hidden bg-neutral-950 p-2 text-neutral-100"
>
	<header
		class="grid gap-3 border-2 border-neutral-700 bg-neutral-900 p-2 text-neutral-100 shadow-[4px_4px_0_#80499c] lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] lg:items-center"
	>
		<div class="flex items-center gap-3">
			<img src={logo} alt="" class="h-10 w-10 object-contain" />
			<h1
				class="text-3xl leading-none font-semibold uppercase md:text-4xl"
				style:font-family="'Saira Extra Condensed', sans-serif"
			>
				Alpaquero
			</h1>
		</div>

		<div class="font-mono text-sm uppercase">
			<p class="text-[0.65rem] font-black tracking-[0.2em] text-purple-200">Observatory</p>
			<p class="truncate text-sm font-black">Sonnenturm Uecht</p>
		</div>

		<div
			class="justify-self-center border border-[#80499c] bg-[#211428] px-3 py-1.5 font-mono text-xs text-purple-100 uppercase"
		>
			{observatoryStatus}
		</div>

		<div
			class="justify-self-start border-2 px-3 py-1.5 font-mono text-sm uppercase shadow-[3px_3px_0_#80499c] lg:justify-self-end"
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
			<p class="text-[0.65rem] leading-none font-black tracking-[0.2em]">Safety</p>
			<p class="mt-1 truncate text-base leading-none font-black">{safetyStatus}</p>
		</div>

		<div
			class="justify-self-start border border-[#80499c] bg-[#211428] px-3 py-1.5 font-mono text-xs text-purple-100 uppercase lg:justify-self-end"
		>
			User menu
		</div>
	</header>

	{#if data.error}
		<section class="border-2 border-red-500 bg-red-950 p-2 text-red-100 shadow-[4px_4px_0_#ef4444]">
			<p class="font-black uppercase">Backend unavailable</p>
			<p class="font-mono">{data.error}</p>
		</section>
	{/if}

	<section class="grid min-h-0 gap-2 xl:grid-cols-[minmax(0,2fr)_minmax(24rem,2fr)]">
		<CameraFeed feeds={cameraFeeds} />

		<aside class="grid min-h-0 grid-rows-[minmax(0,0.58fr)_minmax(0,1fr)] gap-2">
			<section class="min-h-0">
				<SequencePanel availableSequences={data.sequences} activeSequences={liveSequences} />
			</section>

			<div class="grid min-h-0 gap-2 2xl:grid-cols-2">
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

				<WebsocketLogger messages={websocketMessages} status={errorWsStatus} />
			</div>
		</aside>
	</section>

	<section
		class="flex h-full min-h-0 flex-col overflow-hidden border-2 border-neutral-700 bg-neutral-900 p-2 shadow-[4px_4px_0_#80499c]"
	>
		<div
			class="mb-2 flex shrink-0 items-center justify-between gap-3 border-b-2 border-neutral-700 pb-2"
		>
			<div class="flex min-w-0 flex-wrap items-center gap-2">
				<h2 class="shrink-0 text-lg leading-none font-black uppercase">Device Controls</h2>

				{#if showControlTabs}
					<nav class="flex flex-wrap gap-1" aria-label="Device control tabs">
						{#each controlTabs as tab (tab.id)}
							<button
								type="button"
								onclick={() => {
									activeControlTab = tab.id;
								}}
								class="border px-2 py-1 font-mono text-[0.65rem] leading-none font-black uppercase transition-transform active:translate-x-[1px] active:translate-y-[1px]"
								class:border-[#80499c]={tab.id === activeControlTabModel?.id}
								class:bg-[#80499c]={tab.id === activeControlTabModel?.id}
								class:text-neutral-50={tab.id === activeControlTabModel?.id}
								class:border-neutral-600={tab.id !== activeControlTabModel?.id}
								class:bg-neutral-950={tab.id !== activeControlTabModel?.id}
								class:text-neutral-300={tab.id !== activeControlTabModel?.id}
								aria-pressed={tab.id === activeControlTabModel?.id}
							>
								{tab.label}
							</button>
						{/each}
					</nav>
				{/if}
			</div>

			<div class="flex min-w-0 items-center gap-2 font-mono text-xs uppercase">
				{#if observatoryActionError}
					<span class="max-w-64 truncate border border-red-500 bg-red-950 px-2 py-1 text-red-100">
						{observatoryActionError}
					</span>
				{/if}

				<span class="shrink-0 border border-[#80499c] bg-[#211428] px-2 py-1 text-purple-100">
					{observatoryStatus}
				</span>

				<span class="max-w-72 truncate text-neutral-400">
					{observatoryStateMessage}
				</span>
			</div>
		</div>

		<div class="grid min-h-0 flex-1 grid-cols-[3rem_minmax(0,1fr)] gap-2">
			<aside class="flex h-40 flex-col gap-2 self-start" aria-label="Observatory controls">
				{#each OBSERVATORY_ACTIONS as item (item.action)}
					<button
						type="button"
						title={item.title}
						disabled={observatoryActionPending !== null}
						onclick={() => handleObservatoryAction(item.action)}
						class="grid size-12 place-items-center border-2 font-mono text-[0.6rem] leading-none font-black uppercase shadow-[2px_2px_0_#80499c] transition-transform hover:bg-neutral-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-wait disabled:border-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:shadow-none"
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
						{observatoryActionPending === item.action ? '...' : observatoryActionLabel(item.action)}
					</button>
				{/each}
			</aside>

			<div class="h-full min-h-0 min-w-0" bind:this={controlArea}>
				{#if controlDevices.length === 0}
					<p class="font-mono text-neutral-400">
						No configured control devices reported by backend.
					</p>
				{:else}
					<div class="h-full min-h-0 overflow-hidden pr-1 pb-1">
						<div class="flex h-full min-w-max items-stretch gap-2 pr-2">
							{#each activeControlDevices as device (device.id)}
								<div class={deviceControlFrameClass(device) + ' h-full min-h-0 w-fit flex-none'}>
									{#if device.type === 'switch'}
										{@const switchControls = switchControlsForDevice(device)}

										<SwitchBlock
											{device}
											controls={switchControls}
											controlsLoading={switchControls.length === 0 &&
												switchControlsLoadingForDevice(device)}
											controlsError={switchControls.length === 0
												? switchControlsErrorForDevice(device)
												: null}
											onLifecycleComplete={handleLifecycleComplete}
										/>
									{:else}
										{@const DeviceComponent = renderDevice(device)}

										<DeviceComponent {device} onLifecycleComplete={handleLifecycleComplete} />
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</section>
</main>
