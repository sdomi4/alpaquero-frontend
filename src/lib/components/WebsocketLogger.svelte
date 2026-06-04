<script lang="ts">
	type LogMessage = {
		id: string;
		level: string;
		message: string;
		timestamp: string;
		receivedAt: string;
		raw: string;
	};

	type Props = {
		messages: LogMessage[];
		status: 'connecting' | 'connected' | 'disconnected' | 'error';
	};

	let { messages, status }: Props = $props();

	function formatTimestamp(timestamp: string) {
		const date = new Date(timestamp);

		if (Number.isNaN(date.getTime())) return timestamp;

		return date.toLocaleTimeString();
	}

	function levelClass(level: string) {
		const normalized = level.toLowerCase();

		if (normalized === 'error' || normalized === 'critical') {
			return 'border-red-400 bg-red-950 text-red-100';
		}

		if (normalized === 'warning' || normalized === 'warn') {
			return 'border-yellow-300 bg-yellow-950 text-yellow-100';
		}

		return 'border-[#80499c] bg-[#211428] text-purple-100';
	}
</script>

<section
	class="flex h-full min-h-0 flex-col border-2 border-neutral-700 bg-neutral-900 p-2 shadow-[4px_4px_0_#80499c]"
>
	<div class="mb-2 flex items-center justify-between gap-3 border-b-2 border-neutral-700 pb-2">
		<h2 class="text-lg leading-none font-black uppercase">Log</h2>

		<div class="flex items-center gap-2 font-mono text-[0.65rem] uppercase">
			<span class="border border-neutral-600 px-2 py-1">{status}</span>
			<span class="text-neutral-500">{messages.length}</span>
		</div>
	</div>

	{#if messages.length === 0}
		<p class="border-2 border-dashed border-neutral-700 p-3 font-mono text-sm text-neutral-500">
			No websocket messages received.
		</p>
	{:else}
		<ol class="grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1">
			{#each messages as message (message.id)}
				<li class="border border-neutral-700 bg-neutral-950 p-2">
					<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
						<span
							class={`border px-2 py-1 font-mono text-[0.65rem] leading-none font-black uppercase ${levelClass(message.level)}`}
						>
							{message.level}
						</span>

						<time class="font-mono text-[0.65rem] text-neutral-500" datetime={message.timestamp}>
							{formatTimestamp(message.timestamp)}
						</time>
					</div>

					<p class="font-mono text-xs leading-snug text-neutral-100">{message.message}</p>

					<details class="mt-1 font-mono text-[0.65rem] text-neutral-500">
						<summary class="cursor-pointer uppercase">raw</summary>
						<pre
							class="mt-1 border border-neutral-700 bg-neutral-900 p-1 break-words whitespace-pre-wrap">{message.raw}</pre>
					</details>
				</li>
			{/each}
		</ol>
	{/if}
</section>
