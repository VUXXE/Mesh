<script lang="ts">
	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onExportPng: () => void;
		onExportSvg: () => void;
		onExportJson: () => void;
		onOpenMermaid?: () => void;
		onTriggerImport: () => void;
	}

	let {
		isOpen,
		onClose,
		onExportPng,
		onExportSvg,
		onExportJson,
		onOpenMermaid,
		onTriggerImport
	}: Props = $props();
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-20 cursor-default bg-transparent" onclick={onClose}></div>

	<div
		class="absolute right-0 bottom-full z-30 mb-3 w-52 rounded-xl border border-(--surface-2) bg-(--surface-1)/95 p-1.5 shadow-2xl backdrop-blur-md transition-all select-none"
	>
		<div class="px-2 py-1 text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">
			Export Canvas
		</div>
		<button
			onclick={onExportPng}
			class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-(--ink-1) transition-colors hover:bg-(--surface-2) active:scale-98"
		>
			<div class="flex items-center gap-2">
				<span class="font-mono text-[10px] font-bold text-[#6366f1]">PNG</span>
				<span>High-Res Image</span>
			</div>
			<span class="text-[10px] text-(--ink-3)">2x</span>
		</button>
		<button
			onclick={onExportSvg}
			class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-(--ink-1) transition-colors hover:bg-(--surface-2) active:scale-98"
		>
			<div class="flex items-center gap-2">
				<span class="font-mono text-[10px] font-bold text-[#10b981]">SVG</span>
				<span>Vector Graphic</span>
			</div>
			<span class="text-[10px] text-(--ink-3)">XML</span>
		</button>
		<button
			onclick={onExportJson}
			class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-(--ink-1) transition-colors hover:bg-(--surface-2) active:scale-98"
		>
			<div class="flex items-center gap-2">
				<span class="font-mono text-[10px] font-bold text-[#06b6d4]">JSON</span>
				<span>Room Backup</span>
			</div>
			<span class="text-[10px] text-(--ink-3)">Full</span>
		</button>

		<div class="my-1 border-t border-(--surface-2)"></div>

		<div class="px-2 py-1 text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">
			Import / Insert
		</div>
		<button
			onclick={() => {
				onClose();
				onOpenMermaid?.();
			}}
			class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-(--ink-1) transition-colors hover:bg-(--surface-2) active:scale-98"
		>
			<div class="flex items-center gap-2">
				<svg
					class="h-3.5 w-3.5 text-indigo-400"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polygon points="12 2 22 12 12 22 2 12" />
					<polyline points="2 17 12 22 22 17" />
					<polyline points="2 12 12 17 22 12" />
				</svg>
				<span>Mermaid Diagram</span>
			</div>
			<kbd class="font-mono text-[9px] text-(--ink-3)">M</kbd>
		</button>
		<button
			onclick={onTriggerImport}
			class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-(--ink-1) transition-colors hover:bg-(--surface-2) active:scale-98"
		>
			<svg
				class="h-3.5 w-3.5 text-[#f59e0b]"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" y1="3" x2="12" y2="15" />
			</svg>
			<span>Load JSON File...</span>
		</button>
	</div>
{/if}
