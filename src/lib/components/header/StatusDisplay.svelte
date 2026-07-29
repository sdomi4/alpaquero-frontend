<script lang="ts">
	type Props = {
		status: string;
	};

	let { status }: Props = $props();
</script>

<div
	class="shrink-0 border border-[#80499c] bg-[#211428] px-3 py-1.5 font-mono text-xs text-purple-100 uppercase"
>
	<p class="text-[0.6rem] leading-none font-black tracking-[0.16em] text-purple-300">Status</p>
	<p class="mt-1 max-w-40 truncate text-sm leading-none font-black">{status}</p>
</div>
