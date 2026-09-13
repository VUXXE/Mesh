<script lang="ts">
	import type { CanvasEngine, ToolMode } from '$lib/client/canvas-engine';

	interface Props {
		engine: CanvasEngine | null;
		selectedCount: number;
		canUndo?: boolean;
		canRedo?: boolean;
		onUndo?: () => void;
		onRedo?: () => void;
		onClearCanvas: () => void;
	}

	let {
		engine,
		selectedCount,
		canUndo = false,
		canRedo = false,
		onUndo,
		onRedo,
		onClearCanvas
	}: Props = $props();

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

	let showExportMenu = $state(false);
	let fileInputRef: HTMLInputElement;

	function handleExportPng() {
		showExportMenu = false;
		engine?.exportToPng();
	}

	function handleExportSvg() {
		showExportMenu = false;
		engine?.exportToSvg();
	}

	function handleExportJson() {
		showExportMenu = false;
		engine?.exportToJson();
	}

	function triggerImport() {
		showExportMenu = false;
		fileInputRef?.click();
	}

	function handleFileSelected(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const content = event.target?.result as string;
			if (content) {
				engine?.importFromJson(content);
			}
			target.value = '';
		};
		reader.readAsText(file);
	}
</script>

<div
	class="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-[#27272a] bg-[#18181b] px-2.5 py-2 shadow-2xl backdrop-blur-md select-none"
>
	<!-- Undo / Redo Group -->
	<div class="flex items-center gap-0.5">
		<button
			onclick={onUndo}
			disabled={!canUndo}
			class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {canUndo
				? 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
				: 'cursor-not-allowed text-[#52525b] opacity-40'}"
			title="Undo (Ctrl+Z / Cmd+Z)"
			aria-label="Undo"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M3 7v6h6" />
				<path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
			</svg>
		</button>
		<button
			onclick={onRedo}
			disabled={!canRedo}
			class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {canRedo
				? 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
				: 'cursor-not-allowed text-[#52525b] opacity-40'}"
			title="Redo (Ctrl+Shift+Z / Cmd+Shift+Z)"
			aria-label="Redo"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 7v6h-6" />
				<path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
			</svg>
		</button>
	</div>

	<div class="mx-0.5 h-5 w-px bg-[#27272a]"></div>
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

		<!-- Line (L) -->
		<button
			onclick={() => selectTool('line')}
			class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {activeTool ===
			'line'
				? 'bg-[#6366f1] text-white'
				: 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'}"
			title="Line (L) [Hold Shift for 45° snap]"
			aria-label="Line tool"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="5" y1="19" x2="19" y2="5" />
			</svg>
		</button>

		<!-- Arrow (A) -->
		<button
			onclick={() => selectTool('arrow')}
			class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {activeTool ===
			'arrow'
				? 'bg-[#6366f1] text-white'
				: 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'}"
			title="Arrow (A) [Hold Shift for 45° snap]"
			aria-label="Arrow tool"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="5" y1="19" x2="19" y2="5" />
				<polyline points="10 5 19 5 19 14" />
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

		<!-- Hidden File Input for JSON Import -->
		<input
			bind:this={fileInputRef}
			type="file"
			accept=".json"
			onchange={handleFileSelected}
			class="hidden"
		/>

		<!-- Export / Import Menu Button -->
		<div class="relative">
			<button
				onclick={() => (showExportMenu = !showExportMenu)}
				class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none {showExportMenu
					? 'bg-[#27272a] text-[#f4f4f5]'
					: 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'}"
				title="Export or Import whiteboard"
				aria-label="Export or Import whiteboard"
			>
				<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" y1="15" x2="12" y2="3" />
				</svg>
				<span>Export</span>
			</button>

			<!-- Export Popover Menu -->
			{#if showExportMenu}
				<div
					class="absolute bottom-full mb-3 right-0 z-30 w-48 rounded-xl border border-[#27272a] bg-[#18181b] p-1.5 shadow-2xl backdrop-blur-md"
				>
					<div class="px-2 py-1 text-[10px] font-semibold tracking-wider text-[#71717a] uppercase">
						Export
					</div>
					<button
						onclick={handleExportPng}
						class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-[#f4f4f5] transition-colors hover:bg-[#27272a]"
					>
						<span class="font-mono text-[10px] font-bold text-[#6366f1]">PNG</span>
						<span>Image (2x Retina)</span>
					</button>
					<button
						onclick={handleExportSvg}
						class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-[#f4f4f5] transition-colors hover:bg-[#27272a]"
					>
						<span class="font-mono text-[10px] font-bold text-[#10b981]">SVG</span>
						<span>Vector Graphics</span>
					</button>
					<button
						onclick={handleExportJson}
						class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-[#f4f4f5] transition-colors hover:bg-[#27272a]"
					>
						<span class="font-mono text-[10px] font-bold text-[#06b6d4]">JSON</span>
						<span>Mesh Room Backup</span>
					</button>

					<div class="my-1 border-t border-[#27272a]"></div>

					<div class="px-2 py-1 text-[10px] font-semibold tracking-wider text-[#71717a] uppercase">
						Import
					</div>
					<button
						onclick={triggerImport}
						class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-[#f4f4f5] transition-colors hover:bg-[#27272a]"
					>
						<svg class="h-3.5 w-3.5 text-[#f59e0b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="17 8 12 3 7 8" />
							<line x1="12" y1="3" x2="12" y2="15" />
						</svg>
						<span>Load JSON File</span>
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
