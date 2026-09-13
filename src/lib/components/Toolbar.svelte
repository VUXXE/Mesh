<script lang="ts">
	import type { CanvasEngine, ToolMode } from '$lib/client/canvas-engine';

	interface Props {
		engine: CanvasEngine | null;
		selectedCount: number;
		onClearCanvas: () => void;
	}

	let { engine, selectedCount, onClearCanvas }: Props = $props();

	let activeTool = $state<ToolMode>('select');
	let activeColor = $state<string>('#f4f4f5');
	let activeWidth = $state<number>(2);

	const STROKE_COLORS = [
		{ label: 'White', value: '#f4f4f5' },
		{ label: 'Indigo', value: '#6366f1' },
		{ label: 'Cyan', value: '#06b6d4' },
		{ label: 'Emerald', value: '#10b981' },
		{ label: 'Amber', value: '#f59e0b' },
		{ label: 'Rose', value: '#f43f5e' }
	];

	const STROKE_WIDTHS = [
		{ label: 'Thin', value: 2 },
		{ label: 'Medium', value: 4 },
		{ label: 'Bold', value: 8 }
	];

	function selectTool(tool: ToolMode) {
		activeTool = tool;
		engine?.setTool(tool);
	}

	function setColor(color: string) {
		activeColor = color;
		engine?.setStrokeColor(color);
	}

	function setWidth(w: number) {
		activeWidth = w;
		engine?.setStrokeWidth(w);
	}

	function handleDelete() {
		engine?.deleteSelected();
	}

	function handleExportPng() {
		engine?.exportToPng();
	}

	function handleExportSvg() {
		engine?.exportToSvg();
	}
</script>

<div
	class="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-[#27272a] bg-[#18181b] px-2.5 py-2 shadow-2xl backdrop-blur-md select-none"
>
	<!-- Tools Group -->
	<div class="flex items-center gap-1">
		<!-- Select (V) -->
		<button
			onclick={() => selectTool('select')}
			class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {activeTool ===
			'select'
				? 'bg-[#6366f1] text-white'
				: 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'}"
			title="Select (V)"
			aria-label="Select tool"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M3 3l7 18 3-7 7-3L3 3z" />
			</svg>
		</button>

		<!-- Pen (P) -->
		<button
			onclick={() => selectTool('pen')}
			class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {activeTool ===
			'pen'
				? 'bg-[#6366f1] text-white'
				: 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'}"
			title="Pen (P)"
			aria-label="Pen tool"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 19l7-7 3 3-7 7-3-3z" />
				<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
				<path d="M2 2l7.586 7.586" />
				<circle cx="11" cy="11" r="2" />
			</svg>
		</button>

		<!-- Rectangle (R) -->
		<button
			onclick={() => selectTool('rectangle')}
			class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {activeTool ===
			'rectangle'
				? 'bg-[#6366f1] text-white'
				: 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'}"
			title="Rectangle (R)"
			aria-label="Rectangle tool"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="3" y="3" width="18" height="18" rx="2" />
			</svg>
		</button>

		<!-- Ellipse (E) -->
		<button
			onclick={() => selectTool('ellipse')}
			class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {activeTool ===
			'ellipse'
				? 'bg-[#6366f1] text-white'
				: 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'}"
			title="Ellipse (E)"
			aria-label="Ellipse tool"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="9" />
			</svg>
		</button>

		<!-- Text (T) -->
		<button
			onclick={() => selectTool('text')}
			class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {activeTool ===
			'text'
				? 'bg-[#6366f1] text-white'
				: 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'}"
			title="Text (T)"
			aria-label="Text tool"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M4 7V4h16v3" />
				<path d="M9 20h6" />
				<path d="M12 4v16" />
			</svg>
		</button>

		<!-- Sticky Note (S) -->
		<button
			onclick={() => selectTool('sticky_note')}
			class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {activeTool ===
			'sticky_note'
				? 'bg-[#6366f1] text-white'
				: 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'}"
			title="Sticky Note (S)"
			aria-label="Sticky Note tool"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
				<path d="M15 3v6h6" />
			</svg>
		</button>

		<!-- Pan / Hand -->
		<button
			onclick={() => selectTool('pan')}
			class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {activeTool ===
			'pan'
				? 'bg-[#6366f1] text-white'
				: 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'}"
			title="Pan Canvas (Space)"
			aria-label="Pan tool"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
				<path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
				<path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
				<path
					d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"
				/>
			</svg>
		</button>
	</div>

	<div class="mx-1 h-5 w-px bg-[#27272a]"></div>

	<!-- Colors Palette -->
	<div class="flex items-center gap-1.5 px-1">
		{#each STROKE_COLORS as c}
			<button
				onclick={() => setColor(c.value)}
				class="flex h-5 w-5 items-center justify-center rounded-full transition-transform focus:outline-none {activeColor ===
				c.value
					? 'scale-110 ring-2 ring-[#6366f1]'
					: 'hover:scale-105'}"
				style="background-color: {c.value};"
				title={c.label}
				aria-label="{c.label} color"
			>
				{#if activeColor === c.value}
					<span class="h-1.5 w-1.5 rounded-full bg-black/50"></span>
				{/if}
			</button>
		{/each}
	</div>

	<div class="mx-1 h-5 w-px bg-[#27272a]"></div>

	<!-- Stroke Width Selector -->
	<div class="flex items-center gap-1">
		{#each STROKE_WIDTHS as sw}
			<button
				onclick={() => setWidth(sw.value)}
				class="rounded px-2 py-1 text-xs transition-colors focus:outline-none {activeWidth ===
				sw.value
					? 'bg-[#27272a] font-medium text-[#f4f4f5]'
					: 'text-[#a1a1aa] hover:text-[#f4f4f5]'}"
				title="{sw.label} stroke width"
			>
				{sw.label}
			</button>
		{/each}
	</div>

	<div class="mx-1 h-5 w-px bg-[#27272a]"></div>

	<!-- Action Buttons -->
	<div class="flex items-center gap-1">
		{#if selectedCount > 0}
			<button
				onclick={handleDelete}
				class="rounded-lg p-2 text-rose-400 transition-colors hover:bg-[#27272a] hover:text-rose-300 focus:outline-none"
				title="Delete Selection ({selectedCount}) [Del/Backspace]"
				aria-label="Delete selected items"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3 6h18" />
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
					<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
				</svg>
			</button>
		{/if}

		<button
			onclick={onClearCanvas}
			class="rounded-lg p-2 text-[#a1a1aa] transition-colors hover:bg-[#27272a] hover:text-rose-400 focus:outline-none"
			title="Clear entire canvas"
			aria-label="Clear canvas"
		>
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
		</button>

		<!-- Export PNG -->
		<button
			onclick={handleExportPng}
			class="rounded-lg p-2 font-mono text-xs text-[#a1a1aa] transition-colors hover:bg-[#27272a] hover:text-[#f4f4f5] focus:outline-none"
			title="Export PNG"
			aria-label="Export PNG"
		>
			PNG
		</button>

		<!-- Export SVG -->
		<button
			onclick={handleExportSvg}
			class="rounded-lg p-2 font-mono text-xs text-[#a1a1aa] transition-colors hover:bg-[#27272a] hover:text-[#f4f4f5] focus:outline-none"
			title="Export SVG"
			aria-label="Export SVG"
		>
			SVG
		</button>
	</div>
</div>
