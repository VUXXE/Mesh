<script lang="ts">
	import type { CanvasEngine, ToolMode } from '$lib/client/canvas-engine';
	import { FONT_FAMILIES, FONT_SIZES } from '$lib/client/canvas-engine';
	import type { StrokeStyle, FillStyle, CornerRoundness } from '$lib/types';

	interface Props {
		engine: CanvasEngine | null;
		selectedCount: number;
		canUndo?: boolean;
		canRedo?: boolean;
		onUndo?: () => void;
		onRedo?: () => void;
		onClearCanvas: () => void;
		onOpenMermaid?: () => void;
	}

	let {
		engine,
		selectedCount,
		canUndo = false,
		canRedo = false,
		onUndo,
		onRedo,
		onClearCanvas,
		onOpenMermaid
	}: Props = $props();

	let activeTool = $state<ToolMode>('select');
	let activeColor = $state<string>('#f4f4f5');
	let activeWidth = $state<number>(2);
	let activeStrokeStyle = $state<StrokeStyle>('solid');
	let activeFillStyle = $state<FillStyle>('solid');
	let activeFillColor = $state<string>('transparent');
	let activeRoundness = $state<CornerRoundness>('round');
	let activeOpacity = $state<number>(1);
	let activeFontFamily = $state<string>('sans');
	let activeFontSize = $state<number>(18);
	let activeArrowRouting = $state<'straight' | 'orthogonal'>('orthogonal');
	let isTextShapeSelected = $state<boolean>(false);
	let showFillMenu = $state<boolean>(false);
	let showOpacityMenu = $state<boolean>(false);

	const FONT_FAMILY_OPTIONS = [
		{ label: 'Sans', value: 'sans', css: FONT_FAMILIES.sans },
		{ label: 'Serif', value: 'serif', css: FONT_FAMILIES.serif },
		{ label: 'Mono', value: 'mono', css: FONT_FAMILIES.mono }
	];

	function updateSelectedState() {
		if (!engine || selectedCount === 0) {
			isTextShapeSelected = false;
			if (engine) {
				activeStrokeStyle = engine.strokeStyle;
				activeFillStyle = engine.fillStyle;
				activeFillColor = engine.fillColor;
				activeRoundness = engine.roundness;
				activeOpacity = engine.opacity;
			}
			return;
		}
		const textShape = engine.selectedIds
			.map((id) => engine.getShape(id))
			.find((s) => s?.type === 'text');
		isTextShapeSelected = Boolean(textShape);
		if (textShape) {
			if (textShape.data?.fontFamily) {
				activeFontFamily = textShape.data.fontFamily;
			}
			if (textShape.data?.fontSize) {
				activeFontSize = textShape.data.fontSize;
			}
		}

		const firstSelected = engine.selectedIds.map((id) => engine.getShape(id)).find(Boolean);
		if (firstSelected) {
			if (firstSelected.stroke) {
				activeColor = firstSelected.stroke;
			}
			if (firstSelected.strokeWidth) {
				activeWidth = firstSelected.strokeWidth;
			}
			if (firstSelected.fill !== undefined) {
				activeFillColor = firstSelected.fill;
			}
			if (firstSelected.data?.strokeStyle) {
				activeStrokeStyle = firstSelected.data.strokeStyle;
			}
			if (firstSelected.data?.fillStyle) {
				activeFillStyle = firstSelected.data.fillStyle;
			}
			if (firstSelected.data?.roundness) {
				activeRoundness = firstSelected.data.roundness;
			}
			if (firstSelected.data?.opacity !== undefined) {
				activeOpacity = firstSelected.data.opacity;
			}
		}
	}

	$effect(() => {
		selectedCount;
		activeTool;
		updateSelectedState();
	});

	$effect(() => {
		if (engine) {
			activeTool = engine.tool;
			activeColor = engine.strokeColor;
			activeWidth = engine.strokeWidth;
			activeStrokeStyle = engine.strokeStyle;
			activeFillStyle = engine.fillStyle;
			activeFillColor = engine.fillColor;
			activeRoundness = engine.roundness;
			activeOpacity = engine.opacity;
			activeFontFamily = engine.fontFamily;
			activeFontSize = engine.fontSize;
			activeArrowRouting = engine.arrowRouting;
			updateSelectedState();

			engine.onToolChanged = (tool) => {
				activeTool = tool;
				updateSelectedState();
			};
			engine.onStrokeColorChanged = (color) => {
				activeColor = color;
			};
			engine.onFillColorChanged = (color) => {
				activeFillColor = color;
			};
			engine.onStrokeWidthChanged = (width) => {
				activeWidth = width;
			};
			engine.onStrokeStyleChanged = (style) => {
				activeStrokeStyle = style;
			};
			engine.onFillStyleChanged = (style) => {
				activeFillStyle = style;
			};
			engine.onRoundnessChanged = (roundness) => {
				activeRoundness = roundness;
			};
			engine.onOpacityChanged = (opacity) => {
				activeOpacity = opacity;
			};
			engine.onFontFamilyChanged = (family) => {
				activeFontFamily = family;
			};
			engine.onFontSizeChanged = (size) => {
				activeFontSize = size;
			};
			engine.onArrowRoutingChanged = (routing) => {
				activeArrowRouting = routing;
			};
			const unsub = engine.addSelectionListener(() => {
				updateSelectedState();
			});
			return unsub;
		}
	});

	const isTextActive = $derived(activeTool === 'text' || isTextShapeSelected);

	const isArrowActive = $derived.by(() => {
		if (activeTool === 'arrow' || activeTool === 'line') return true;
		if (!engine || selectedCount === 0) return false;
		return engine.selectedIds.some((id) => {
			const s = engine.getShape(id);
			return s && s.type === 'path' && s.data?.isArrow;
		});
	});

	const hasNonTextSelected = $derived.by(() => {
		if (!engine || selectedCount === 0) return false;
		return engine.selectedIds.some((id) => {
			const s = engine.getShape(id);
			return s && s.type !== 'text';
		});
	});

	const showStrokeWidth = $derived(
		activeTool === 'pen' ||
			activeTool === 'line' ||
			activeTool === 'arrow' ||
			activeTool === 'rectangle' ||
			activeTool === 'diamond' ||
			activeTool === 'ellipse' ||
			hasNonTextSelected ||
			(activeTool === 'select' && selectedCount === 0)
	);

	const isRectActive = $derived.by(() => {
		if (activeTool === 'rectangle') return true;
		if (!engine || selectedCount === 0) return false;
		return engine.selectedIds.some((id) => {
			const s = engine.getShape(id);
			return s && s.type === 'rectangle';
		});
	});

	const showFillControls = $derived.by(() => {
		if (activeTool === 'rectangle' || activeTool === 'ellipse' || activeTool === 'diamond')
			return true;
		if (!engine || selectedCount === 0) return false;
		return engine.selectedIds.some((id) => {
			const s = engine.getShape(id);
			return (
				s &&
				(s.type === 'rectangle' || s.type === 'ellipse' || (s.type === 'path' && s.data?.isDiamond))
			);
		});
	});

	const STROKE_COLORS = [
		{ label: 'White', value: '#f4f4f5' },
		{ label: 'Indigo', value: '#6366f1' },
		{ label: 'Cyan', value: '#06b6d4' },
		{ label: 'Emerald', value: '#10b981' },
		{ label: 'Amber', value: '#f59e0b' },
		{ label: 'Rose', value: '#f43f5e' }
	];

	const FILL_COLORS = [
		{ label: 'None', value: 'transparent' },
		{ label: 'White', value: '#f4f4f5' },
		{ label: 'Indigo', value: '#6366f1' },
		{ label: 'Cyan', value: '#06b6d4' },
		{ label: 'Emerald', value: '#10b981' },
		{ label: 'Amber', value: '#f59e0b' },
		{ label: 'Rose', value: '#f43f5e' }
	];

	const FILL_STYLES: { label: string; value: FillStyle }[] = [
		{ label: 'Solid', value: 'solid' },
		{ label: 'Hachure', value: 'hachure' },
		{ label: 'Cross-hatch', value: 'cross-hatch' }
	];

	const OPACITY_PRESETS = [
		{ label: '100%', value: 1 },
		{ label: '75%', value: 0.75 },
		{ label: '50%', value: 0.5 },
		{ label: '25%', value: 0.25 }
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

	function setStrokeStyle(style: StrokeStyle) {
		activeStrokeStyle = style;
		engine?.setStrokeStyle(style);
	}

	function setFillStyle(style: FillStyle) {
		activeFillStyle = style;
		engine?.setFillStyle(style);
	}

	function setFillColor(color: string) {
		activeFillColor = color;
		engine?.setFillColor(color);
	}

	function setRoundness(roundness: CornerRoundness) {
		activeRoundness = roundness;
		engine?.setRoundness(roundness);
	}

	function setOpacity(opacity: number) {
		activeOpacity = opacity;
		engine?.setOpacity(opacity);
	}

	function setFontFamily(family: string) {
		activeFontFamily = family;
		engine?.setFontFamily(family);
	}

	function setFontSize(size: number) {
		activeFontSize = size;
		engine?.setFontSize(size);
	}

	function setArrowRouting(routing: 'straight' | 'orthogonal') {
		activeArrowRouting = routing;
		engine?.setArrowRouting(routing);
	}

	function handleDelete() {
		engine?.deleteSelected();
	}

	let showExportMenu = $state(false);
	let fileInputRef: HTMLInputElement;

	function handleExportPng() {
		showExportMenu = false;
		if (!engine) {
			alert('Canvas is still initializing. Please try again.');
			return;
		}
		engine.exportToPng();
	}

	function handleExportSvg() {
		showExportMenu = false;
		if (!engine) {
			alert('Canvas is still initializing. Please try again.');
			return;
		}
		engine.exportToSvg();
	}

	function handleExportJson() {
		showExportMenu = false;
		if (!engine) {
			alert('Canvas is still initializing. Please try again.');
			return;
		}
		engine.exportToJson();
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
	class="fixed bottom-6 left-1/2 z-20 flex max-w-[95vw] -translate-x-1/2 items-center gap-1.5 overflow-visible rounded-xl border border-(--surface-2) bg-(--surface-1) px-2.5 py-2 shadow-2xl backdrop-blur-md select-none"
>
	<!-- Scrollable Tools Area (for mobile & small viewports) -->
	<div class="no-scrollbar flex max-w-full items-center gap-1.5 overflow-x-auto py-0.5">
		<!-- Undo / Redo Group -->
		<div class="flex items-center gap-0.5">
			<button
				onclick={onUndo}
				disabled={!canUndo}
				class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {canUndo
					? 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'
					: 'cursor-not-allowed text-(--ink-disabled) opacity-40'}"
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
					? 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'
					: 'cursor-not-allowed text-(--ink-disabled) opacity-40'}"
				title="Redo (Ctrl+Shift+Z / Cmd+Shift+Z)"
				aria-label="Redo"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 7v6h-6" />
					<path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
				</svg>
			</button>
		</div>

		<div class="mx-0.5 h-5 w-px bg-(--surface-2)"></div>
		<!-- Tools Group -->
		<div class="flex items-center gap-1">
			<!-- Select (V) -->
			<button
				onclick={() => selectTool('select')}
				class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {activeTool ===
				'select'
					? 'bg-[#6366f1] text-white'
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
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
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
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
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
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
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
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
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
				title="Rectangle (R)"
				aria-label="Rectangle tool"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="18" height="18" rx="2" />
				</svg>
			</button>

			<!-- Diamond (D) -->
			<button
				onclick={() => selectTool('diamond')}
				class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {activeTool ===
				'diamond'
					? 'bg-[#6366f1] text-white'
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
				title="Diamond (D)"
				aria-label="Diamond tool"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polygon points="12 2 22 12 12 22 2 12" />
				</svg>
			</button>

			<!-- Ellipse (E) -->
			<button
				onclick={() => selectTool('ellipse')}
				class="flex items-center justify-center rounded-lg p-2 text-sm transition-all focus:outline-none {activeTool ===
				'ellipse'
					? 'bg-[#6366f1] text-white'
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
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
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
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
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
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
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
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

		<div class="mx-1 h-5 w-px bg-(--surface-2)"></div>

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

		<!-- Stroke Width Selector -->
		{#if showStrokeWidth}
			<div class="mx-1 h-5 w-px bg-(--surface-2)"></div>
			<div class="flex items-center gap-1">
				{#each STROKE_WIDTHS as sw}
					<button
						onclick={() => setWidth(sw.value)}
						class="rounded px-2 py-1 text-xs transition-colors focus:outline-none {activeWidth ===
						sw.value
							? 'bg-(--surface-2) font-medium text-(--ink-1)'
							: 'text-(--ink-2) hover:text-(--ink-1)'}"
						title="{sw.label} stroke width"
					>
						{sw.label}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Stroke Style Selector (Solid, Dashed, Dotted) -->
		{#if showStrokeWidth}
			<div class="mx-1 h-5 w-px bg-(--surface-2)"></div>
			<div class="flex items-center gap-0.5">
				<button
					onclick={() => setStrokeStyle('solid')}
					class="flex items-center justify-center rounded p-1.5 text-xs transition-colors focus:outline-none {activeStrokeStyle ===
					'solid'
						? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
						: 'text-(--ink-2) hover:text-(--ink-1)'}"
					title="Solid stroke"
					aria-label="Solid stroke"
				>
					<svg
						class="h-3.5 w-4"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="1" y1="8" x2="15" y2="8" />
					</svg>
				</button>
				<button
					onclick={() => setStrokeStyle('dashed')}
					class="flex items-center justify-center rounded p-1.5 text-xs transition-colors focus:outline-none {activeStrokeStyle ===
					'dashed'
						? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
						: 'text-(--ink-2) hover:text-(--ink-1)'}"
					title="Dashed stroke"
					aria-label="Dashed stroke"
				>
					<svg
						class="h-3.5 w-4"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-dasharray="3 2"
					>
						<line x1="1" y1="8" x2="15" y2="8" />
					</svg>
				</button>
				<button
					onclick={() => setStrokeStyle('dotted')}
					class="flex items-center justify-center rounded p-1.5 text-xs transition-colors focus:outline-none {activeStrokeStyle ===
					'dotted'
						? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
						: 'text-(--ink-2) hover:text-(--ink-1)'}"
					title="Dotted stroke"
					aria-label="Dotted stroke"
				>
					<svg
						class="h-3.5 w-4"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-dasharray="1 2.5"
						stroke-linecap="round"
					>
						<line x1="1" y1="8" x2="15" y2="8" />
					</svg>
				</button>
			</div>
		{/if}

		<!-- Fill Color & Pattern Popover -->
		{#if showFillControls}
			<div class="mx-1 h-5 w-px bg-(--surface-2)"></div>
			<div class="relative">
				<button
					onclick={() => {
						showFillMenu = !showFillMenu;
						showOpacityMenu = false;
						showExportMenu = false;
					}}
					class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors focus:outline-none {showFillMenu
						? 'bg-(--surface-2) font-medium text-(--ink-1)'
						: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
					title="Fill color and pattern"
					aria-label="Fill options"
				>
					<span class="text-[11px] font-medium">Fill</span>
					<span
						class="relative flex h-3.5 w-3.5 items-center justify-center overflow-hidden rounded-xs border border-(--surface-2)"
						style="background-color: {activeFillColor === 'transparent'
							? 'transparent'
							: activeFillColor};"
					>
						{#if activeFillColor === 'transparent'}
							<span class="h-[1px] w-4 rotate-45 bg-rose-400"></span>
						{:else if activeFillStyle === 'hachure'}
							<svg class="absolute inset-0 h-full w-full" viewBox="0 0 14 14">
								<line x1="0" y1="14" x2="14" y2="0" stroke="rgba(0,0,0,0.45)" stroke-width="1.5" />
							</svg>
						{:else if activeFillStyle === 'cross-hatch'}
							<svg class="absolute inset-0 h-full w-full" viewBox="0 0 14 14">
								<line x1="0" y1="14" x2="14" y2="0" stroke="rgba(0,0,0,0.45)" stroke-width="1.5" />
								<line x1="0" y1="0" x2="14" y2="14" stroke="rgba(0,0,0,0.45)" stroke-width="1.5" />
							</svg>
						{/if}
					</span>
				</button>

				{#if showFillMenu}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="fixed inset-0 z-20 cursor-default bg-transparent"
						onclick={() => (showFillMenu = false)}
					></div>
					<div
						class="absolute bottom-full left-0 z-30 mb-3 w-56 rounded-xl border border-(--surface-2) bg-(--surface-1) p-2.5 shadow-2xl backdrop-blur-md"
					>
						<div class="mb-1.5 text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">
							Fill Color
						</div>
						<div class="mb-3 flex items-center gap-1.5">
							{#each FILL_COLORS as fc}
								<button
									onclick={() => setFillColor(fc.value)}
									class="flex h-5 w-5 items-center justify-center rounded-full transition-transform focus:outline-none {activeFillColor ===
									fc.value
										? 'scale-110 ring-2 ring-[#6366f1]'
										: 'hover:scale-105'} {fc.value === 'transparent'
										? 'border border-(--surface-2) bg-transparent'
										: ''}"
									style={fc.value !== 'transparent' ? `background-color: ${fc.value};` : ''}
									title={fc.label}
									aria-label="{fc.label} fill color"
								>
									{#if fc.value === 'transparent'}
										<span class="h-[1px] w-3.5 rotate-45 bg-rose-400"></span>
									{:else if activeFillColor === fc.value}
										<span class="h-1.5 w-1.5 rounded-full bg-black/50"></span>
									{/if}
								</button>
							{/each}
						</div>

						<div class="mb-1.5 text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">
							Fill Pattern
						</div>
						<div class="flex items-center gap-1">
							{#each FILL_STYLES as fs}
								<button
									onclick={() => setFillStyle(fs.value)}
									class="flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs transition-colors focus:outline-none {activeFillStyle ===
									fs.value
										? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
										: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
									title="{fs.label} pattern"
								>
									{#if fs.value === 'solid'}
										<span class="h-2.5 w-2.5 rounded-xs bg-current"></span>
									{:else if fs.value === 'hachure'}
										<svg
											class="h-3 w-3"
											viewBox="0 0 12 12"
											fill="none"
											stroke="currentColor"
											stroke-width="1.5"
										>
											<line x1="1" y1="11" x2="11" y2="1" />
											<line x1="1" y1="6" x2="6" y2="1" />
											<line x1="6" y1="11" x2="11" y2="6" />
										</svg>
									{:else if fs.value === 'cross-hatch'}
										<svg
											class="h-3 w-3"
											viewBox="0 0 12 12"
											fill="none"
											stroke="currentColor"
											stroke-width="1.5"
										>
											<line x1="1" y1="11" x2="11" y2="1" />
											<line x1="1" y1="6" x2="6" y2="1" />
											<line x1="6" y1="11" x2="11" y2="6" />
											<line x1="1" y1="6" x2="6" y2="11" />
										</svg>
									{/if}
									<span class="text-[10px]">{fs.label}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Corner Roundness (Sharp vs Round for rectangles) -->
		{#if isRectActive}
			<div class="mx-1 h-5 w-px bg-(--surface-2)"></div>
			<div class="flex items-center gap-0.5">
				<button
					onclick={() => setRoundness('sharp')}
					class="flex items-center justify-center rounded p-1.5 text-xs transition-colors focus:outline-none {activeRoundness ===
					'sharp'
						? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
						: 'text-(--ink-2) hover:text-(--ink-1)'}"
					title="Sharp corners (90°)"
					aria-label="Sharp corners"
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polyline points="3,13 3,3 13,3" />
					</svg>
				</button>
				<button
					onclick={() => setRoundness('round')}
					class="flex items-center justify-center rounded p-1.5 text-xs transition-colors focus:outline-none {activeRoundness ===
					'round'
						? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
						: 'text-(--ink-2) hover:text-(--ink-1)'}"
					title="Rounded corners"
					aria-label="Rounded corners"
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M3 13V7a4 4 0 0 1 4-4h6" />
					</svg>
				</button>
			</div>
		{/if}

		<!-- Arrow Routing Selector (Straight vs Elbow) -->
		{#if isArrowActive}
			<div class="mx-1 h-5 w-px bg-(--surface-2)"></div>
			<div class="flex items-center gap-1">
				<button
					onclick={() => setArrowRouting('orthogonal')}
					class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors focus:outline-none {activeArrowRouting ===
					'orthogonal'
						? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
						: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
					title="Elbow / Orthogonal (90° step arrow)"
					aria-label="Elbow arrow routing"
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M5 19h7a4 4 0 0 0 4-4V5" />
						<polyline points="12 9 16 5 20 9" />
					</svg>
					<span class="hidden sm:inline">Elbow</span>
				</button>
				<button
					onclick={() => setArrowRouting('straight')}
					class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors focus:outline-none {activeArrowRouting ===
					'straight'
						? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
						: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
					title="Straight line arrow"
					aria-label="Straight arrow routing"
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="5" y1="19" x2="19" y2="5" />
						<polyline points="10 5 19 5 19 14" />
					</svg>
					<span class="hidden sm:inline">Straight</span>
				</button>
			</div>
		{/if}

		<!-- Font Family and Font Size Selector -->
		{#if isTextActive}
			<div class="mx-1 h-5 w-px bg-(--surface-2)"></div>

			<!-- Font Family Selector (Sans, Serif, Mono) -->
			<div class="flex items-center gap-1">
				{#each FONT_FAMILY_OPTIONS as f}
					<button
						onclick={() => setFontFamily(f.value)}
						class="rounded px-2 py-1 text-xs transition-colors focus:outline-none {activeFontFamily ===
						f.value
							? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
							: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
						title="{f.label} font family"
						style="font-family: {f.css};"
						aria-label="{f.label} font family"
					>
						{f.label}
					</button>
				{/each}
			</div>

			<div class="mx-1 h-5 w-px bg-(--surface-2)"></div>

			<!-- Font Size Selector (S, M, L, XL) -->
			<div class="flex items-center gap-1">
				{#each FONT_SIZES as s}
					<button
						onclick={() => setFontSize(s.value)}
						class="rounded px-2 py-1 text-xs transition-colors focus:outline-none {activeFontSize ===
						s.value
							? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
							: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
						title={s.title}
						aria-label="{s.label} font size"
					>
						{s.label}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Opacity Popover -->
		<div class="mx-1 h-5 w-px bg-(--surface-2)"></div>
		<div class="relative">
			<button
				onclick={() => {
					showOpacityMenu = !showOpacityMenu;
					showFillMenu = false;
					showExportMenu = false;
				}}
				class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors focus:outline-none {showOpacityMenu
					? 'bg-(--surface-2) font-medium text-(--ink-1)'
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
				title="Opacity ({Math.round(activeOpacity * 100)}%)"
				aria-label="Opacity options"
			>
				<svg
					class="h-3.5 w-3.5 text-(--ink-2)"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="9" />
					<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" opacity={activeOpacity} />
				</svg>
				<span class="font-mono text-[10px]">{Math.round(activeOpacity * 100)}%</span>
			</button>

			{#if showOpacityMenu}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="fixed inset-0 z-20 cursor-default bg-transparent"
					onclick={() => (showOpacityMenu = false)}
				></div>
				<div
					class="absolute bottom-full left-1/2 z-30 mb-3 w-40 -translate-x-1/2 rounded-xl border border-(--surface-2) bg-(--surface-1) p-2.5 shadow-2xl backdrop-blur-md"
				>
					<div
						class="mb-1.5 flex items-center justify-between text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase"
					>
						<span>Opacity</span>
						<span class="font-mono text-(--ink-1)">{Math.round(activeOpacity * 100)}%</span>
					</div>
					<input
						type="range"
						min="10"
						max="100"
						step="5"
						value={Math.round(activeOpacity * 100)}
						oninput={(e) => setOpacity(Number((e.target as HTMLInputElement).value) / 100)}
						class="mb-2 h-1.5 w-full cursor-pointer accent-[#6366f1]"
					/>
					<div class="grid grid-cols-4 gap-1">
						{#each OPACITY_PRESETS as op}
							<button
								onclick={() => setOpacity(op.value)}
								class="rounded px-1 py-0.5 font-mono text-[10px] transition-colors focus:outline-none {Math.abs(
									activeOpacity - op.value
								) < 0.05
									? 'bg-(--surface-2) font-bold text-(--ink-1) ring-1 ring-[#6366f1]'
									: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
							>
								{op.label}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div class="mx-1 h-5 w-px bg-(--surface-2)"></div>

		<!-- Action Buttons -->
		<div class="flex items-center gap-1">
			{#if selectedCount > 0}
				<!-- Duplicate -->
				<button
					onclick={() => engine?.duplicateSelected()}
					class="rounded-lg p-2 text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none"
					title="Duplicate ({selectedCount}) [Ctrl+D / Cmd+D]"
					aria-label="Duplicate selected items"
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
					</svg>
				</button>

				<!-- Bring to Front -->
				<button
					onclick={() => engine?.bringToFront()}
					class="rounded-lg p-2 text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none"
					title="Bring to Front [Ctrl+] / Cmd+]]"
					aria-label="Bring to front"
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="18 15 12 9 6 15" />
						<line x1="6" y1="5" x2="18" y2="5" />
					</svg>
				</button>

				<!-- Send to Back -->
				<button
					onclick={() => engine?.sendToBack()}
					class="rounded-lg p-2 text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none"
					title="Send to Back [Ctrl+[ / Cmd+[]"
					aria-label="Send to back"
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="6 9 12 15 18 9" />
						<line x1="6" y1="19" x2="18" y2="19" />
					</svg>
				</button>

				<!-- Delete -->
				<button
					onclick={handleDelete}
					class="rounded-lg p-2 text-rose-400 transition-colors hover:bg-(--surface-2) hover:text-rose-300 focus:outline-none"
					title="Delete Selection ({selectedCount}) [Del/Backspace]"
					aria-label="Delete selected items"
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M3 6h18" />
						<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
						<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
					</svg>
				</button>
			{/if}

			<button
				onclick={onClearCanvas}
				class="rounded-lg p-2 text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-rose-400 focus:outline-none"
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
		</div>
	</div>

	<div class="mx-0.5 h-5 w-px shrink-0 bg-(--surface-2)"></div>

	<!-- Text to Diagram (Mermaid) Button -->
	<button
		onclick={onOpenMermaid}
		class="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none"
		title="Text to Diagram / Mermaid (M)"
		aria-label="Text to Diagram"
	>
		<svg
			class="h-3.5 w-3.5 text-indigo-400"
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

	<div class="mx-0.5 h-5 w-px shrink-0 bg-(--surface-2)"></div>

	<!-- Hidden File Input for JSON Import -->
	<input
		bind:this={fileInputRef}
		type="file"
		accept=".json"
		onchange={handleFileSelected}
		class="hidden"
	/>

	<!-- Export / Import Menu Button -->
	<div class="relative shrink-0">
		<button
			onclick={() => (showExportMenu = !showExportMenu)}
			class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none {showExportMenu
				? 'bg-(--surface-2) text-(--ink-1)'
				: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
			title="Export or Import whiteboard"
			aria-label="Export or Import whiteboard"
		>
			<svg
				class="h-3.5 w-3.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="7 10 12 15 17 10" />
				<line x1="12" y1="15" x2="12" y2="3" />
			</svg>
			<span>Export</span>
		</button>

		<!-- Export Popover Menu -->
		{#if showExportMenu}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="fixed inset-0 z-20 cursor-default bg-transparent"
				onclick={() => (showExportMenu = false)}
			></div>

			<div
				class="absolute right-0 bottom-full z-30 mb-3 w-48 rounded-xl border border-(--surface-2) bg-(--surface-1) p-1.5 shadow-2xl backdrop-blur-md"
			>
				<div class="px-2 py-1 text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">
					Export
				</div>
				<button
					onclick={handleExportPng}
					class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-(--ink-1) transition-colors hover:bg-(--surface-2)"
				>
					<span class="font-mono text-[10px] font-bold text-[#6366f1]">PNG</span>
					<span>Image (2x Retina)</span>
				</button>
				<button
					onclick={handleExportSvg}
					class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-(--ink-1) transition-colors hover:bg-(--surface-2)"
				>
					<span class="font-mono text-[10px] font-bold text-[#10b981]">SVG</span>
					<span>Vector Graphics</span>
				</button>
				<button
					onclick={handleExportJson}
					class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-(--ink-1) transition-colors hover:bg-(--surface-2)"
				>
					<span class="font-mono text-[10px] font-bold text-[#06b6d4]">JSON</span>
					<span>Mesh Room Backup</span>
				</button>

				<div class="my-1 border-t border-(--surface-2)"></div>

				<div class="px-2 py-1 text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">
					Import
				</div>
				<button
					onclick={() => {
						showExportMenu = false;
						onOpenMermaid?.();
					}}
					class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-(--ink-1) transition-colors hover:bg-(--surface-2)"
				>
					<svg
						class="h-3.5 w-3.5 text-indigo-400"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polygon points="12 2 2 7 12 12 22 7 12 2" />
						<polyline points="2 17 12 22 22 17" />
						<polyline points="2 12 12 17 22 12" />
					</svg>
					<span>Mermaid Diagram...</span>
				</button>
				<button
					onclick={triggerImport}
					class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-(--ink-1) transition-colors hover:bg-(--surface-2)"
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
					<span>Load JSON File</span>
				</button>
			</div>
		{/if}
	</div>
</div>
