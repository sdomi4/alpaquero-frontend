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

		return 'border-cyan-300 bg-cyan-950 text-cyan-100';
	}
</script>

<section class="border-4 border-neutral-100 bg-neutral-900 p-4 shadow-[8px_8px_0_#06b6d4]">
	<div class="mb-3 flex items-end justify-between gap-3 border-b-4 border-neutral-100 pb-2">
		<div>
			<p class="font-mono text-xs text-neutral-400 uppercase">/ws/errors</p>
			<h2 class="text-2xl font-black uppercase">Logger</h2>
		</div>

		<div class="flex flex-col items-end gap-1 font-mono text-xs uppercase">
			<span class="border-2 border-neutral-100 px-2 py-1">{status}</span>
			<span class="text-neutral-400">{messages.length} messages</span>
		</div>
	</div>

	{#if messages.length === 0}
		<p class="border-2 border-dashed border-neutral-700 p-3 font-mono text-sm text-neutral-500">
			No websocket messages received.
		</p>
	{:else}
		<ol class="grid max-h-[28rem] gap-3 overflow-y-auto pr-1">
			{#each messages as message (message.id)}
				<li class="border-2 border-neutral-600 bg-neutral-950 p-3">
					<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
						<span
							class={`border-2 px-2 py-1 font-mono text-xs font-black uppercase ${levelClass(message.level)}`}
						>
							{message.level}
						</span>

						<time class="font-mono text-xs text-neutral-500" datetime={message.timestamp}>
							{formatTimestamp(message.timestamp)}
						</time>
					</div>

					<p class="font-mono text-sm leading-relaxed text-neutral-100">{message.message}</p>

					<details class="mt-2 font-mono text-xs text-neutral-500">
						<summary class="cursor-pointer uppercase">raw</summary>
						<pre
							class="mt-2 border border-neutral-700 bg-neutral-900 p-2 break-words whitespace-pre-wrap">{message.raw}</pre>
					</details>
				</li>
			{/each}
		</ol>
	{/if}
</section>
