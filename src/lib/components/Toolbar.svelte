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
	let isPanelCollapsed = $state<boolean>(false);
	let showExportMenu = $state<boolean>(false);

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

	const showSidePanel = $derived(
		activeTool === 'pen' ||
			activeTool === 'line' ||
			activeTool === 'arrow' ||
			activeTool === 'rectangle' ||
			activeTool === 'diamond' ||
			activeTool === 'ellipse' ||
			activeTool === 'text' ||
			activeTool === 'sticky_note' ||
			selectedCount > 0
	);

	const STROKE_COLORS = [
		{ label: 'White', value: '#f4f4f5' },
		{ label: 'Slate', value: '#94a3b8' },
		{ label: 'Zinc', value: '#71717a' },
		{ label: 'Charcoal', value: '#27272a' },
		{ label: 'Red', value: '#ef4444' },
		{ label: 'Rose', value: '#f43f5e' },
		{ label: 'Pink', value: '#ec4899' },
		{ label: 'Purple', value: '#a855f7' },
		{ label: 'Indigo', value: '#6366f1' },
		{ label: 'Blue', value: '#3b82f6' },
		{ label: 'Cyan', value: '#06b6d4' },
		{ label: 'Teal', value: '#14b8a6' },
		{ label: 'Emerald', value: '#10b981' },
		{ label: 'Green', value: '#22c55e' },
		{ label: 'Lime', value: '#84cc16' },
		{ label: 'Amber', value: '#f59e0b' },
		{ label: 'Orange', value: '#f97316' }
	];

	const FILL_COLORS = [
		{ label: 'None', value: 'transparent' },
		{ label: 'White', value: '#ffffff' },
		{ label: 'Slate', value: '#94a3b8' },
		{ label: 'Charcoal', value: '#27272a' },
		{ label: 'Pastel Red', value: '#fecdd3' },
		{ label: 'Vivid Red', value: '#ef4444' },
		{ label: 'Pastel Pink', value: '#fbcfe8' },
		{ label: 'Pastel Purple', value: '#e9d5ff' },
		{ label: 'Pastel Indigo', value: '#c7d2fe' },
		{ label: 'Vivid Blue', value: '#3b82f6' },
		{ label: 'Pastel Cyan', value: '#cffafe' },
		{ label: 'Pastel Teal', value: '#ccfbf1' },
		{ label: 'Pastel Emerald', value: '#bbf7d0' },
		{ label: 'Pastel Lime', value: '#ecfccb' },
		{ label: 'Pastel Yellow', value: '#fef08a' },
		{ label: 'Pastel Orange', value: '#fed7aa' },
		{ label: 'Vivid Orange', value: '#f97316' }
	];

	const isCustomStrokeColor = $derived(
		Boolean(activeColor) &&
			!STROKE_COLORS.some((c) => c.value.toLowerCase() === activeColor.toLowerCase())
	);

	const isCustomFillColor = $derived(
		Boolean(activeFillColor) &&
			activeFillColor !== 'transparent' &&
			!FILL_COLORS.some((c) => c.value.toLowerCase() === activeFillColor.toLowerCase())
	);

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

<!-- SIDE STYLING PANEL (Excalidraw-style properties on left side) -->
{#if showSidePanel}
	{#if isPanelCollapsed}
		<div class="fixed top-16 left-4 z-20 select-none">
			<button
				onclick={() => (isPanelCollapsed = false)}
				class="flex items-center gap-1.5 rounded-xl border border-(--surface-2) bg-(--surface-1)/95 px-3 py-2 text-xs font-medium text-(--ink-1) shadow-xl backdrop-blur-md transition-all hover:bg-(--surface-2)"
				title="Expand style panel"
				aria-label="Expand style panel"
			>
				<svg
					class="h-4 w-4 text-[#6366f1]"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
					<circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
					<circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
					<circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
					<path
						d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
					/>
				</svg>
				<span>Styles</span>
			</button>
		</div>
	{:else}
		<div
			class="no-scrollbar fixed top-16 left-4 z-20 flex max-h-[calc(100vh-5.5rem)] w-60 flex-col gap-3.5 overflow-y-auto rounded-2xl border border-(--surface-2) bg-(--surface-1)/95 p-3 shadow-2xl backdrop-blur-md transition-all select-none"
		>
			<!-- Panel Header: Title + Collapse Button -->
			<div class="flex items-center justify-between border-b border-(--surface-2) pb-2">
				<div class="flex items-center gap-1.5">
					<span class="h-2 w-2 rounded-full bg-[#6366f1]"></span>
					<span class="text-xs font-semibold tracking-tight text-(--ink-1)">
						{selectedCount > 0 ? `${selectedCount} selected` : 'Properties'}
					</span>
				</div>
				<button
					onclick={() => (isPanelCollapsed = true)}
					class="rounded-md p-1 text-(--ink-3) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1)"
					title="Collapse panel"
					aria-label="Collapse panel"
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polyline points="15 18 9 12 15 6" />
					</svg>
				</button>
			</div>

			<!-- 1. STROKE COLOR SECTION -->
			<div class="space-y-1.5">
				<div
					class="flex items-center justify-between text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase"
				>
					<span>Stroke Color</span>
					<span class="font-mono text-[9px] text-(--ink-2)">{activeColor}</span>
				</div>

				<div class="grid grid-cols-6 gap-1.5">
					{#each STROKE_COLORS as c}
						<button
							onclick={() => setColor(c.value)}
							class="flex h-5 w-5 items-center justify-center rounded-full transition-transform focus:outline-none {activeColor.toLowerCase() ===
							c.value.toLowerCase()
								? 'scale-110 ring-2 ring-[#6366f1]'
								: 'hover:scale-105'} {c.value === '#27272a' || c.value === '#18181b'
								? 'border border-(--surface-2)'
								: ''}"
							style="background-color: {c.value};"
							title={c.label}
							aria-label="{c.label} stroke color"
						>
							{#if activeColor.toLowerCase() === c.value.toLowerCase()}
								<span class="h-1.5 w-1.5 rounded-full bg-black/50"></span>
							{/if}
						</button>
					{/each}

					<!-- Custom Stroke Color Picker Button -->
					<label
						class="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-dashed border-(--ink-3) transition-transform focus-within:ring-2 focus-within:ring-[#6366f1] hover:scale-110 hover:border-[#6366f1]"
						title="Custom Color (Hex / Eyedropper)"
						aria-label="Custom stroke color"
					>
						<input
							type="color"
							value={activeColor.startsWith('#') && activeColor.length === 7
								? activeColor
								: '#6366f1'}
							oninput={(e) => setColor((e.target as HTMLInputElement).value)}
							class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
						/>
						<svg
							class="h-3 w-3 text-(--ink-2)"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<line x1="12" y1="5" x2="12" y2="19" />
							<line x1="5" y1="12" x2="19" y2="12" />
						</svg>
					</label>
				</div>

				{#if isCustomStrokeColor}
					<div
						class="mt-1 flex items-center justify-between rounded-lg bg-(--surface-2)/60 px-2 py-0.5"
					>
						<div class="flex items-center gap-1.5">
							<span
								class="h-2.5 w-2.5 rounded-full border border-white/20"
								style="background-color: {activeColor};"
							></span>
							<span class="font-mono text-[10px] text-(--ink-1) uppercase">{activeColor}</span>
						</div>
						<span class="text-[9px] text-(--ink-3)">Custom</span>
					</div>
				{/if}
			</div>

			<!-- 2. FILL COLOR & PATTERN SECTION -->
			{#if showFillControls}
				<div class="space-y-1.5 border-t border-(--surface-2)/60 pt-2.5">
					<div
						class="flex items-center justify-between text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase"
					>
						<span>Fill / Background</span>
						<span class="font-mono text-[9px] text-(--ink-2)">{activeFillColor}</span>
					</div>

					<div class="grid grid-cols-6 gap-1.5">
						{#each FILL_COLORS as fc}
							<button
								onclick={() => setFillColor(fc.value)}
								class="flex h-5 w-5 items-center justify-center rounded-full transition-transform focus:outline-none {activeFillColor.toLowerCase() ===
								fc.value.toLowerCase()
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
								{:else if activeFillColor.toLowerCase() === fc.value.toLowerCase()}
									<span class="h-1.5 w-1.5 rounded-full bg-black/50"></span>
								{/if}
							</button>
						{/each}

						<!-- Custom Fill Color Picker Button -->
						<label
							class="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-dashed border-(--ink-3) transition-transform focus-within:ring-2 focus-within:ring-[#6366f1] hover:scale-110 hover:border-[#6366f1]"
							title="Custom Fill Color"
							aria-label="Custom fill color"
						>
							<input
								type="color"
								value={activeFillColor.startsWith('#') && activeFillColor.length === 7
									? activeFillColor
									: '#6366f1'}
								oninput={(e) => setFillColor((e.target as HTMLInputElement).value)}
								class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
							/>
							<svg
								class="h-3 w-3 text-(--ink-2)"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
						</label>
					</div>

					{#if isCustomFillColor}
						<div
							class="mt-1 flex items-center justify-between rounded-lg bg-(--surface-2)/60 px-2 py-0.5"
						>
							<div class="flex items-center gap-1.5">
								<span
									class="h-2.5 w-2.5 rounded-full border border-white/20"
									style="background-color: {activeFillColor};"
								></span>
								<span class="font-mono text-[10px] text-(--ink-1) uppercase">{activeFillColor}</span
								>
							</div>
							<span class="text-[9px] text-(--ink-3)">Custom</span>
						</div>
					{/if}

					<!-- Fill Style Patterns -->
					<div class="pt-1">
						<div class="mb-1 text-[9px] font-medium text-(--ink-3) uppercase">Pattern</div>
						<div class="grid grid-cols-3 gap-1">
							{#each FILL_STYLES as fs}
								<button
									onclick={() => setFillStyle(fs.value)}
									class="flex items-center justify-center gap-1 rounded-lg py-1 text-xs transition-colors focus:outline-none {activeFillStyle ===
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
				</div>
			{/if}

			<!-- 3. STROKE WIDTH & STROKE STYLE SECTION -->
			{#if showStrokeWidth}
				<div class="space-y-1.5 border-t border-(--surface-2)/60 pt-2.5">
					<div class="text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">
						Stroke Width
					</div>
					<div class="grid grid-cols-3 gap-1">
						{#each STROKE_WIDTHS as sw}
							<button
								onclick={() => setWidth(sw.value)}
								class="flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-xs transition-colors focus:outline-none {activeWidth ===
								sw.value
									? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
									: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
								title="{sw.label} stroke width ({sw.value}px)"
								aria-label="{sw.label} stroke width"
							>
								<span
									class="w-6 rounded-full bg-current"
									style="height: {sw.value <= 2 ? 1.5 : sw.value <= 4 ? 3 : 5}px;"
								></span>
								<span class="text-[9px]">{sw.label}</span>
							</button>
						{/each}
					</div>

					<div class="pt-1">
						<div class="mb-1 text-[9px] font-medium text-(--ink-3) uppercase">Stroke Style</div>
						<div class="grid grid-cols-3 gap-1">
							<button
								onclick={() => setStrokeStyle('solid')}
								class="flex items-center justify-center rounded-lg py-1.5 text-xs transition-colors focus:outline-none {activeStrokeStyle ===
								'solid'
									? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
									: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
								title="Solid stroke"
								aria-label="Solid stroke"
							>
								<svg
									class="h-3.5 w-7"
									viewBox="0 0 28 8"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<line x1="1" y1="4" x2="27" y2="4" />
								</svg>
							</button>
							<button
								onclick={() => setStrokeStyle('dashed')}
								class="flex items-center justify-center rounded-lg py-1.5 text-xs transition-colors focus:outline-none {activeStrokeStyle ===
								'dashed'
									? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
									: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
								title="Dashed stroke"
								aria-label="Dashed stroke"
							>
								<svg
									class="h-3.5 w-7"
									viewBox="0 0 28 8"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-dasharray="5 3"
								>
									<line x1="1" y1="4" x2="27" y2="4" />
								</svg>
							</button>
							<button
								onclick={() => setStrokeStyle('dotted')}
								class="flex items-center justify-center rounded-lg py-1.5 text-xs transition-colors focus:outline-none {activeStrokeStyle ===
								'dotted'
									? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
									: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
								title="Dotted stroke"
								aria-label="Dotted stroke"
							>
								<svg
									class="h-3.5 w-7"
									viewBox="0 0 28 8"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-dasharray="2 3"
									stroke-linecap="round"
								>
									<line x1="1" y1="4" x2="27" y2="4" />
								</svg>
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- 4. CORNER ROUNDNESS SECTION (Rectangles) -->
			{#if isRectActive}
				<div class="space-y-1.5 border-t border-(--surface-2)/60 pt-2.5">
					<div class="text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">Edges</div>
					<div class="grid grid-cols-2 gap-1">
						<button
							onclick={() => setRoundness('sharp')}
							class="flex items-center justify-center gap-1.5 rounded-lg py-1 text-xs transition-colors focus:outline-none {activeRoundness ===
							'sharp'
								? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
								: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
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
							<span class="text-[10px]">Sharp</span>
						</button>
						<button
							onclick={() => setRoundness('round')}
							class="flex items-center justify-center gap-1.5 rounded-lg py-1 text-xs transition-colors focus:outline-none {activeRoundness ===
							'round'
								? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
								: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
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
							<span class="text-[10px]">Round</span>
						</button>
					</div>
				</div>
			{/if}

			<!-- 5. ARROW ROUTING SECTION -->
			{#if isArrowActive}
				<div class="space-y-1.5 border-t border-(--surface-2)/60 pt-2.5">
					<div class="text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">
						Arrow Routing
					</div>
					<div class="grid grid-cols-2 gap-1">
						<button
							onclick={() => setArrowRouting('orthogonal')}
							class="flex items-center justify-center gap-1.5 rounded-lg py-1 text-xs transition-colors focus:outline-none {activeArrowRouting ===
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
							<span class="text-[10px]">Elbow</span>
						</button>
						<button
							onclick={() => setArrowRouting('straight')}
							class="flex items-center justify-center gap-1.5 rounded-lg py-1 text-xs transition-colors focus:outline-none {activeArrowRouting ===
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
							<span class="text-[10px]">Straight</span>
						</button>
					</div>
				</div>
			{/if}

			<!-- 6. TYPOGRAPHY SECTION -->
			{#if isTextActive}
				<div class="space-y-1.5 border-t border-(--surface-2)/60 pt-2.5">
					<div class="text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">Font</div>
					<div class="grid grid-cols-3 gap-1">
						{#each FONT_FAMILY_OPTIONS as f}
							<button
								onclick={() => setFontFamily(f.value)}
								class="rounded-lg py-1 text-xs transition-colors focus:outline-none {activeFontFamily ===
								f.value
									? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
									: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
								title="{f.label} font family"
								style="font-family: {f.css};"
							>
								{f.label}
							</button>
						{/each}
					</div>
					<div class="grid grid-cols-4 gap-1 pt-0.5">
						{#each FONT_SIZES as s}
							<button
								onclick={() => setFontSize(s.value)}
								class="rounded-lg py-1 text-xs transition-colors focus:outline-none {activeFontSize ===
								s.value
									? 'bg-(--surface-2) font-medium text-(--ink-1) ring-1 ring-[#6366f1]'
									: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
								title={s.title}
							>
								{s.label}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- 7. OPACITY SECTION -->
			<div class="space-y-1.5 border-t border-(--surface-2)/60 pt-2.5">
				<div
					class="flex items-center justify-between text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase"
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
					class="h-1.5 w-full cursor-pointer accent-[#6366f1]"
				/>
				<div class="grid grid-cols-4 gap-1">
					{#each OPACITY_PRESETS as op}
						<button
							onclick={() => setOpacity(op.value)}
							class="rounded-md py-0.5 font-mono text-[10px] transition-colors focus:outline-none {Math.abs(
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

			<!-- 8. SELECTION ACTIONS SECTION -->
			{#if selectedCount > 0}
				<div class="space-y-1.5 border-t border-(--surface-2)/60 pt-2.5">
					<div class="text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">
						Actions
					</div>
					<div class="grid grid-cols-4 gap-1">
						<!-- Duplicate -->
						<button
							onclick={() => engine?.duplicateSelected()}
							class="flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none"
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
							<span class="text-[9px]">Clone</span>
						</button>

						<!-- Bring to Front -->
						<button
							onclick={() => engine?.bringToFront()}
							class="flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none"
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
							<span class="text-[9px]">Front</span>
						</button>

						<!-- Send to Back -->
						<button
							onclick={() => engine?.sendToBack()}
							class="flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none"
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
							<span class="text-[9px]">Back</span>
						</button>

						<!-- Delete -->
						<button
							onclick={handleDelete}
							class="flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-rose-400 transition-colors hover:bg-(--surface-2) hover:text-rose-300 focus:outline-none"
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
							<span class="text-[9px]">Delete</span>
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/if}

<!-- PRIMARY BOTTOM DOCK (Clean, tools-focused, always visible) -->
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

		<div class="mx-0.5 h-5 w-px bg-(--surface-2)"></div>

		<!-- Clear Entire Canvas -->
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
						<polygon points="12 2 22 12 12 22 2 12" />
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
