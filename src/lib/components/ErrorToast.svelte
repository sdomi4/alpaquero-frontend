<script lang="ts">
	type LogMessage = {
		id: string;
		level: string;
		message: string;
		timestamp: string;
	};

	type Props = {
		message: LogMessage | null;
		onDismiss: () => void;
		timeoutMs?: number;
	};

	let { message, onDismiss, timeoutMs = 6000 }: Props = $props();

	$effect(() => {
		if (!message) return;

		const timer = window.setTimeout(onDismiss, timeoutMs);

		return () => window.clearTimeout(timer);
	});

	function formatTimestamp(timestamp: string) {
		const date = new Date(timestamp);

		if (Number.isNaN(date.getTime())) return timestamp;

		return date.toLocaleTimeString();
	}
</script>

{#if message}
	<section
		class="fixed top-4 right-4 z-50 w-[min(28rem,calc(100vw-2rem))] border-4 border-red-200 bg-red-950 text-red-50 shadow-[8px_8px_0_#ef4444]"
		aria-live="assertive"
		aria-atomic="true"
	>
		<div class="flex items-start justify-between gap-3 border-b-4 border-red-200 bg-red-700 p-3">
			<div>
				<p class="font-mono text-xs font-black tracking-[0.2em] text-red-100 uppercase">
					{message.level}
				</p>
				<p class="font-mono text-xs text-red-100">{formatTimestamp(message.timestamp)}</p>
			</div>

			<button
				type="button"
				onclick={onDismiss}
				class="border-2 border-red-100 px-2 py-1 font-mono text-xs font-black text-red-50 uppercase hover:bg-red-800"
				aria-label="Dismiss error notification"
			>
				close
			</button>
		</div>

		<p class="p-3 font-mono text-sm leading-relaxed">{message.message}</p>
	</section>
{/if}
