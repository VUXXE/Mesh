<script lang="ts">
	import type { ToolMode } from '$lib/client/canvas-engine';
	import ToolButton from './ToolButton.svelte';
	import ExportMenu from './ExportMenu.svelte';

	interface Props {
		activeTool: ToolMode;
		activeColor: string;
		activeFillColor: string;
		activeWidth: number;
		canUndo?: boolean;
		canRedo?: boolean;
		isPanelOpen?: boolean;
		showExportMenu: boolean;
		onSelectTool: (tool: ToolMode) => void;
		onUndo?: () => void;
		onRedo?: () => void;
		onClearCanvas: () => void;
		onToggleProperties: () => void;
		onToggleExportMenu: () => void;
		onCloseExportMenu: () => void;
		onExportPng: () => void;
		onExportSvg: () => void;
		onExportJson: () => void;
		onOpenMermaid?: () => void;
		onTriggerImport: () => void;
	}

	let {
		activeTool,
		activeColor,
		activeFillColor,
		activeWidth,
		canUndo = false,
		canRedo = false,
		isPanelOpen = false,
		showExportMenu,
		onSelectTool,
		onUndo,
		onRedo,
		onClearCanvas,
		onToggleProperties,
		onToggleExportMenu,
		onCloseExportMenu,
		onExportPng,
		onExportSvg,
		onExportJson,
		onOpenMermaid,
		onTriggerImport
	}: Props = $props();
</script>

<div
	class="fixed bottom-6 left-1/2 z-20 flex max-w-[95vw] -translate-x-1/2 items-center gap-1 rounded-2xl border border-(--surface-2) bg-(--surface-1)/95 p-1.5 shadow-2xl backdrop-blur-md select-none"
>
	<!-- Scrollable Tools Row for compact viewports -->
	<div class="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto py-0.5">
		<!-- History Group: Undo / Redo -->
		<div class="flex items-center gap-0.5">
			<ToolButton label="Undo" shortcut="⌘Z" disabled={!canUndo} onclick={onUndo}>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3 7v6h6" />
					<path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
				</svg>
			</ToolButton>

			<ToolButton label="Redo" shortcut="⇧⌘Z" disabled={!canRedo} onclick={onRedo}>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 7v6h-6" />
					<path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
				</svg>
			</ToolButton>
		</div>

		<div class="mx-1 h-5 w-px shrink-0 bg-(--surface-2)"></div>

		<!-- Navigation & Select Group -->
		<div class="flex items-center gap-0.5">
			<ToolButton
				label="Select"
				shortcut="V"
				active={activeTool === 'select'}
				onclick={() => onSelectTool('select')}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3 3l7 18 3-7 7-3L3 3z" />
				</svg>
			</ToolButton>

			<ToolButton
				label="Pan Canvas"
				shortcut="H"
				active={activeTool === 'pan'}
				onclick={() => onSelectTool('pan')}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
					<path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
					<path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
					<path
						d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"
					/>
				</svg>
			</ToolButton>
		</div>

		<div class="mx-1 h-5 w-px shrink-0 bg-(--surface-2)"></div>

		<!-- Creation Tools Group -->
		<div class="flex items-center gap-0.5">
			<ToolButton
				label="Draw"
				shortcut="P"
				active={activeTool === 'pen'}
				onclick={() => onSelectTool('pen')}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 19l7-7 3 3-7 7-3-3z" />
					<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
				</svg>
			</ToolButton>

			<ToolButton
				label="Line"
				shortcut="L"
				active={activeTool === 'line'}
				onclick={() => onSelectTool('line')}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="5" y1="19" x2="19" y2="5" />
				</svg>
			</ToolButton>

			<ToolButton
				label="Arrow"
				shortcut="A"
				active={activeTool === 'arrow'}
				onclick={() => onSelectTool('arrow')}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="5" y1="19" x2="19" y2="5" />
					<polyline points="10 5 19 5 19 14" />
				</svg>
			</ToolButton>

			<ToolButton
				label="Rectangle"
				shortcut="R"
				active={activeTool === 'rectangle'}
				onclick={() => onSelectTool('rectangle')}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="18" height="18" rx="2" />
				</svg>
			</ToolButton>

			<ToolButton
				label="Diamond"
				shortcut="D"
				active={activeTool === 'diamond'}
				onclick={() => onSelectTool('diamond')}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polygon points="12 2 22 12 12 22 2 12" />
				</svg>
			</ToolButton>

			<ToolButton
				label="Ellipse"
				shortcut="E"
				active={activeTool === 'ellipse'}
				onclick={() => onSelectTool('ellipse')}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="9" />
				</svg>
			</ToolButton>

			<ToolButton
				label="Text"
				shortcut="T"
				active={activeTool === 'text'}
				onclick={() => onSelectTool('text')}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M4 7V4h16v3" />
					<path d="M9 20h6" />
					<path d="M12 4v16" />
				</svg>
			</ToolButton>

			<ToolButton
				label="Sticky Note"
				shortcut="S"
				active={activeTool === 'sticky_note'}
				onclick={() => onSelectTool('sticky_note')}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
					<path d="M15 3v6h6" />
				</svg>
			</ToolButton>
		</div>

		<div class="mx-1 h-5 w-px shrink-0 bg-(--surface-2)"></div>

		<!-- Contextual Active Style Pill & Inspector Trigger -->
		<div class="group relative">
			<button
				onclick={onToggleProperties}
				class="flex h-9 items-center gap-2 rounded-xl border border-(--surface-2) px-2 text-xs font-medium transition-[background-color,color,border-color,transform] duration-100 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] active:scale-95 {isPanelOpen
					? 'border-(--surface-3) bg-(--surface-2) text-(--ink-1)'
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
				title="Toggle Properties & Styling"
				aria-label="Toggle Properties"
			>
				<div class="relative flex h-4 w-4 shrink-0 items-center justify-center">
					<!-- Active Stroke Dot with high-contrast borders -->
					<span
						class="h-3.5 w-3.5 rounded-full border border-black/40 shadow-xs dark:border-white/30"
						style="background-color: {activeColor};"
					></span>
					{#if activeFillColor !== 'transparent'}
						<span
							class="absolute h-1.5 w-1.5 rounded-full border border-black/40 dark:border-white/30"
							style="background-color: {activeFillColor};"
						></span>
					{/if}
				</div>
				<!-- Mini Stroke Width Indicator -->
				<span
					class="hidden w-4 rounded-full bg-current transition-all sm:block"
					style="height: {activeWidth <= 2 ? 2 : activeWidth <= 4 ? 3 : 4.5}px;"
				></span>
				<span class="hidden md:inline">Style</span>
			</button>
			<span
				class="pointer-events-none absolute -top-9 left-1/2 z-30 flex -translate-x-1/2 scale-95 items-center gap-1.5 rounded-md border border-(--surface-2) bg-(--surface-1) px-2 py-1 text-[11px] font-medium whitespace-nowrap text-(--ink-1) opacity-0 shadow-lg backdrop-blur-md transition-all duration-150 ease-out group-hover:scale-100 group-hover:opacity-100"
			>
				<span>Inspector</span>
				<kbd class="py-0.2 rounded bg-(--surface-2) px-1 font-mono text-[9px] text-(--ink-2)">
					Props
				</kbd>
			</span>
		</div>

		<div class="mx-1 h-5 w-px shrink-0 bg-(--surface-2)"></div>

		<!-- Clear Canvas -->
		<ToolButton label="Clear Canvas" variant="danger" onclick={onClearCanvas}>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 2v4" />
				<path d="M12 18v4" />
				<path d="M4.93 4.93l2.83 2.83" />
				<path d="M16.24 16.24l2.83 2.83" />
				<path d="M2 12h4" />
				<path d="M18 12h4" />
				<path d="M4.93 19.07l2.83-2.83" />
				<path d="M16.24 7.76l2.83-2.83" />
			</svg>
		</ToolButton>
	</div>

	<div class="mx-0.5 h-5 w-px shrink-0 bg-(--surface-2)"></div>

	<!-- Text to Diagram (Mermaid) Button -->
	<div class="group relative shrink-0">
		<button
			onclick={onOpenMermaid}
			class="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-(--ink-2) transition-[background-color,color,transform] duration-100 ease-out hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] active:scale-95"
			aria-label="Text to Diagram"
		>
			<svg
				class="h-4 w-4 text-indigo-400"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<rect x="3" y="3" width="6" height="6" rx="1" />
				<rect x="15" y="3" width="6" height="6" rx="1" />
				<rect x="9" y="15" width="6" height="6" rx="1" />
				<path d="M6 9v3a3 3 0 0 0 3 3h3" />
				<path d="M18 9v3a3 3 0 0 1-3 3h-3" />
			</svg>
			<span class="hidden sm:inline">Diagram</span>
		</button>
		<span
			class="pointer-events-none absolute -top-9 left-1/2 z-30 flex -translate-x-1/2 scale-95 items-center gap-1.5 rounded-md border border-(--surface-2) bg-(--surface-1) px-2 py-1 text-[11px] font-medium whitespace-nowrap text-(--ink-1) opacity-0 shadow-lg backdrop-blur-md transition-all duration-150 ease-out group-hover:scale-100 group-hover:opacity-100"
		>
			<span>Mermaid Flowchart</span>
			<kbd class="py-0.2 rounded bg-(--surface-2) px-1 font-mono text-[9px] text-(--ink-2)">M</kbd>
		</span>
	</div>

	<div class="mx-0.5 h-5 w-px shrink-0 bg-(--surface-2)"></div>

	<!-- Export / Import Menu Popover Trigger -->
	<div class="relative shrink-0">
		<button
			onclick={onToggleExportMenu}
			class="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition-[background-color,color,transform] duration-100 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] active:scale-95 {showExportMenu
				? 'bg-(--surface-2) text-(--ink-1)'
				: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
			title="Export or Import whiteboard"
			aria-label="Export or Import whiteboard"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="7 10 12 15 17 10" />
				<line x1="12" y1="15" x2="12" y2="3" />
			</svg>
			<span class="hidden sm:inline">Export</span>
		</button>

		<!-- Export Popover Menu -->
		<ExportMenu
			isOpen={showExportMenu}
			onClose={onCloseExportMenu}
			{onExportPng}
			{onExportSvg}
			{onExportJson}
			{onOpenMermaid}
			{onTriggerImport}
		/>
	</div>
</div>
