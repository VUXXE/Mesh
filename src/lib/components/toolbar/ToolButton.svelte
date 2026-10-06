<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		active?: boolean;
		disabled?: boolean;
		label: string;
		shortcut?: string;
		variant?: 'default' | 'danger';
		onclick?: () => void;
		children?: Snippet;
	}

	let {
		active = false,
		disabled = false,
		label,
		shortcut,
		variant = 'default',
		onclick,
		children
	}: Props = $props();
</script>

<div class="group relative">
	<button
		{onclick}
		{disabled}
		class="flex h-9 w-9 items-center justify-center rounded-xl text-sm transition-[background-color,color,transform] duration-100 ease-out focus:outline-none active:scale-95 {disabled
			? 'cursor-not-allowed text-(--ink-disabled) opacity-35'
			: variant === 'danger'
				? 'text-(--ink-2) hover:bg-rose-500/10 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-rose-500'
				: active
					? 'bg-[#6366f1] font-semibold text-white shadow-xs focus-visible:ring-2 focus-visible:ring-[#6366f1]'
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1) focus-visible:ring-2 focus-visible:ring-[#6366f1]'}"
		aria-label={label}
	>
		{@render children?.()}
	</button>

	{#if !disabled}
		<span
			class="pointer-events-none absolute -top-9 left-1/2 z-30 flex -translate-x-1/2 scale-95 items-center gap-1.5 rounded-md border border-(--surface-2) bg-(--surface-1) px-2 py-1 text-[11px] font-medium whitespace-nowrap opacity-0 shadow-lg backdrop-blur-md transition-all duration-150 ease-out group-hover:scale-100 group-hover:opacity-100 {variant ===
			'danger'
				? 'text-rose-400'
				: 'text-(--ink-1)'}"
		>
			<span>{label}</span>
			{#if shortcut}
				<kbd class="py-0.2 rounded bg-(--surface-2) px-1 font-mono text-[9px] text-(--ink-2)">
					{shortcut}
				</kbd>
			{/if}
		</span>
	{/if}
</div>
