<script lang="ts">
	import type { CanvasEngine, ToolMode } from '$lib/client/canvas-engine';
	import { FONT_SIZES } from '$lib/client/canvas-engine';
	import type { StrokeStyle, FillStyle, CornerRoundness } from '$lib/types';
	import {
		FONT_FAMILY_OPTIONS,
		STROKE_COLORS,
		PRIMARY_STROKE_COLORS,
		MORE_STROKE_COLORS,
		FILL_COLORS,
		PRIMARY_FILL_COLORS,
		MORE_FILL_COLORS,
		FILL_STYLES,
		OPACITY_PRESETS,
		STROKE_WIDTHS,
		getToolDisplayName
	} from './constants';

	interface Props {
		engine: CanvasEngine | null;
		activeTool: ToolMode;
		selectedCount: number;
		activeColor: string;
		activeWidth: number;
		activeStrokeStyle: StrokeStyle;
		activeFillStyle: FillStyle;
		activeFillColor: string;
		activeRoundness: CornerRoundness;
		activeOpacity: number;
		activeFontFamily: string;
		activeFontSize: number;
		activeArrowRouting: 'straight' | 'orthogonal';
		isTextActive: boolean;
		isArrowActive: boolean;
		isRectActive: boolean;
		showStrokeWidth: boolean;
		showFillControls: boolean;
		isCollapsed: boolean;
		onToggleCollapse: () => void;
		onSetColor: (color: string) => void;
		onSetWidth: (width: number) => void;
		onSetStrokeStyle: (style: StrokeStyle) => void;
		onSetFillStyle: (style: FillStyle) => void;
		onSetFillColor: (color: string) => void;
		onSetRoundness: (roundness: CornerRoundness) => void;
		onSetOpacity: (opacity: number) => void;
		onSetFontFamily: (family: string) => void;
		onSetFontSize: (size: number) => void;
		onSetArrowRouting: (routing: 'straight' | 'orthogonal') => void;
		onDelete: () => void;
	}

	let {
		engine,
		activeTool,
		selectedCount,
		activeColor,
		activeWidth,
		activeStrokeStyle,
		activeFillStyle,
		activeFillColor,
		activeRoundness,
		activeOpacity,
		activeFontFamily,
		activeFontSize,
		activeArrowRouting,
		isTextActive,
		isArrowActive,
		isRectActive,
		showStrokeWidth,
		showFillControls,
		isCollapsed,
		onToggleCollapse,
		onSetColor,
		onSetWidth,
		onSetStrokeStyle,
		onSetFillStyle,
		onSetFillColor,
		onSetRoundness,
		onSetOpacity,
		onSetFontFamily,
		onSetFontSize,
		onSetArrowRouting,
		onDelete
	}: Props = $props();

	let isStrokeExpanded = $state(false);
	let isFillExpanded = $state(false);

	const isExtendedStrokeActive = $derived(
		MORE_STROKE_COLORS.some((c) => c.value.toLowerCase() === activeColor.toLowerCase())
	);

	const visibleStrokeColors = $derived(
		isStrokeExpanded || isExtendedStrokeActive ? STROKE_COLORS : PRIMARY_STROKE_COLORS
	);

	const isExtendedFillActive = $derived(
		MORE_FILL_COLORS.some((c) => c.value.toLowerCase() === activeFillColor.toLowerCase())
	);

	const visibleFillColors = $derived(
		isFillExpanded || isExtendedFillActive ? FILL_COLORS : PRIMARY_FILL_COLORS
	);

	const isCustomStrokeColor = $derived(
		Boolean(activeColor) &&
			!STROKE_COLORS.some((c) => c.value.toLowerCase() === activeColor.toLowerCase())
	);

	const isCustomFillColor = $derived(
		Boolean(activeFillColor) &&
			activeFillColor !== 'transparent' &&
			!FILL_COLORS.some((c) => c.value.toLowerCase() === activeFillColor.toLowerCase())
	);
</script>

{#if isCollapsed}
	<div class="fixed top-16 left-4 z-20 select-none">
		<button
			onclick={onToggleCollapse}
			class="group flex items-center gap-2 rounded-xl border border-(--surface-2) bg-(--surface-1)/95 px-3 py-2 text-xs font-medium text-(--ink-1) shadow-xl backdrop-blur-md transition-[background-color,border-color,transform] duration-150 ease-out hover:border-(--surface-3) hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:outline-none active:scale-95"
			title="Expand properties inspector"
			aria-label="Expand properties inspector"
		>
			<span
				class="flex h-4.5 w-4.5 items-center justify-center rounded-full border border-black/40 shadow-2xs dark:border-white/30"
				style="background-color: {activeColor};"
			></span>
			<span class="font-medium">Properties</span>
			{#if selectedCount > 0}
				<span
					class="py-0.2 rounded-full bg-[#6366f1]/20 px-1.5 font-mono text-[10px] font-bold text-[#6366f1]"
				>
					{selectedCount}
				</span>
			{/if}
			<svg
				class="h-3.5 w-3.5 text-(--ink-3) transition-transform group-hover:translate-x-0.5 group-hover:text-(--ink-1)"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<polyline points="9 18 15 12 9 6" />
			</svg>
		</button>
	</div>
{:else}
	<div
		class="no-scrollbar fixed top-16 left-4 z-20 flex max-h-[calc(100vh-5.5rem)] w-72 flex-col gap-3 overflow-y-auto rounded-xl border border-(--surface-2) bg-(--surface-1)/95 p-3.5 shadow-2xl backdrop-blur-md transition-[background-color,border-color] duration-150 select-none"
	>
		<!-- Header: Context & Quick Actions -->
		<div
			class="sticky -top-3.5 z-10 -mx-3.5 -mt-3.5 flex items-center justify-between border-b border-(--surface-2) bg-(--surface-1)/95 px-3.5 py-2.5 backdrop-blur-md"
		>
			<div class="flex items-center gap-2">
				{#if selectedCount > 0}
					<span
						class="flex h-5 items-center justify-center rounded-md bg-[#6366f1]/20 px-1.5 font-mono text-[10px] font-bold text-[#6366f1]"
					>
						{selectedCount}
					</span>
					<span class="text-xs font-semibold tracking-tight text-(--ink-1)">
						{selectedCount === 1 ? 'Selected Item' : `${selectedCount} Items Selected`}
					</span>
				{:else}
					<span
						class="flex h-5 w-5 items-center justify-center rounded-md bg-(--surface-2) text-xs text-[#6366f1]"
					>
						{#if activeTool === 'rectangle'}
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<rect x="3" y="3" width="18" height="18" rx="2" />
							</svg>
						{:else if activeTool === 'diamond'}
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<polygon points="12 2 22 12 12 22 2 12" />
							</svg>
						{:else if activeTool === 'ellipse'}
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="12" cy="12" r="9" />
							</svg>
						{:else if activeTool === 'arrow'}
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
						{:else if activeTool === 'line'}
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<line x1="5" y1="19" x2="19" y2="5" />
							</svg>
						{:else if activeTool === 'pen'}
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M12 19l7-7 3 3-7 7-3-3z" />
								<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
							</svg>
						{:else if activeTool === 'text'}
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M4 7V4h16v3" />
								<path d="M9 20h6" />
								<path d="M12 4v16" />
							</svg>
						{:else}
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="12" cy="12" r="9" />
							</svg>
						{/if}
					</span>
					<span class="text-xs font-semibold tracking-tight text-(--ink-1)">
						{getToolDisplayName(activeTool)} Tool
					</span>
				{/if}
			</div>

			<div class="flex items-center gap-1">
				{#if selectedCount > 0}
					<button
						onclick={() => engine?.duplicateSelected()}
						class="flex h-6 w-6 items-center justify-center rounded text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus-visible:ring-1 focus-visible:ring-[#6366f1] active:scale-95"
						title="Clone selected (Ctrl+D)"
						aria-label="Clone selection"
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
						</svg>
					</button>
					<button
						onclick={onDelete}
						class="flex h-6 w-6 items-center justify-center rounded text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300 focus-visible:ring-1 focus-visible:ring-rose-500 active:scale-95"
						title="Delete selected (Backspace)"
						aria-label="Delete selection"
					>
						<svg
							class="h-3.5 w-3.5"
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
					onclick={onToggleCollapse}
					class="flex h-6 w-6 items-center justify-center rounded text-(--ink-3) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus-visible:ring-1 focus-visible:ring-[#6366f1] active:scale-95"
					title="Collapse properties panel"
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
		</div>

		<!-- 1. STROKE COLOR SECTION -->
		<div class="space-y-1.5">
			<div
				class="flex items-center justify-between text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase"
			>
				<span>Stroke</span>
				<div class="flex items-center gap-1.5">
					<span class="font-mono text-[9px] text-(--ink-2)">{activeColor}</span>
					<button
						onclick={() => (isStrokeExpanded = !isStrokeExpanded)}
						class="text-[9px] font-medium tracking-normal text-[#6366f1] hover:underline"
						type="button"
					>
						{isStrokeExpanded ? 'Less' : 'More'}
					</button>
				</div>
			</div>

			<div class="grid grid-cols-6 justify-items-center gap-1.5">
				{#each visibleStrokeColors as c}
					<button
						onclick={() => onSetColor(c.value)}
						class="group relative flex h-6 w-6 items-center justify-center rounded-md border border-black/40 shadow-2xs transition-[transform,ring-offset-width] duration-100 ease-out hover:scale-110 focus:outline-none active:scale-95 dark:border-white/30 {activeColor.toLowerCase() ===
						c.value.toLowerCase()
							? 'scale-105 ring-2 ring-[#6366f1] ring-offset-2 ring-offset-(--surface-1)'
							: ''}"
						style="background-color: {c.value};"
						title={c.label}
						aria-label="{c.label} stroke color"
					>
						{#if activeColor.toLowerCase() === c.value.toLowerCase()}
							<span
								class="h-1.5 w-1.5 rounded-full {c.value === '#ffffff' || c.value === '#d4d4d8'
									? 'bg-black'
									: 'bg-white'}"
							></span>
						{/if}
					</button>
				{/each}

				<!-- Custom Stroke Color Picker Button -->
				<label
					class="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-dashed border-(--surface-3) bg-(--surface-2)/40 transition-[transform,border-color,background-color] duration-100 focus-within:ring-2 focus-within:ring-[#6366f1] hover:scale-110 hover:border-[#6366f1] hover:bg-(--surface-2)"
					title="Custom stroke color (Hex / RGB / Eyedropper)"
					aria-label="Custom stroke color"
				>
					<input
						type="color"
						value={activeColor.startsWith('#') && activeColor.length === 7
							? activeColor
							: '#6366f1'}
						oninput={(e) => onSetColor((e.target as HTMLInputElement).value)}
						class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
					/>
					<svg
						class="h-3.5 w-3.5 text-(--ink-2)"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
				</label>
			</div>

			{#if isCustomStrokeColor}
				<div
					class="mt-1 flex items-center justify-between rounded-md border border-(--surface-2) bg-(--surface-0)/70 px-2 py-1"
				>
					<div class="flex items-center gap-1.5">
						<span
							class="h-3 w-3 rounded-full border border-black/40 shadow-xs dark:border-white/30"
							style="background-color: {activeColor};"
						></span>
						<span class="font-mono text-[10px] font-medium text-(--ink-1) uppercase"
							>{activeColor}</span
						>
					</div>
					<span class="text-[9px] font-medium tracking-wider text-[#6366f1] uppercase">Custom</span>
				</div>
			{/if}
		</div>

		<!-- 2. BACKGROUND / FILL SECTION -->
		{#if showFillControls}
			<div class="space-y-1.5 border-t border-(--surface-2)/70 pt-2.5">
				<div
					class="flex items-center justify-between text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase"
				>
					<span>Background</span>
					<div class="flex items-center gap-1.5">
						<span class="font-mono text-[9px] text-(--ink-2)">{activeFillColor}</span>
						<button
							onclick={() => (isFillExpanded = !isFillExpanded)}
							class="text-[9px] font-medium tracking-normal text-[#6366f1] hover:underline"
							type="button"
						>
							{isFillExpanded ? 'Less' : 'More'}
						</button>
					</div>
				</div>

				<div class="grid grid-cols-6 justify-items-center gap-1.5">
					{#each visibleFillColors as fc}
						<button
							onclick={() => onSetFillColor(fc.value)}
							class="group relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-md border border-black/40 shadow-2xs transition-[transform,ring-offset-width] duration-100 ease-out hover:scale-110 focus:outline-none active:scale-95 dark:border-white/30 {activeFillColor.toLowerCase() ===
							fc.value.toLowerCase()
								? 'scale-105 ring-2 ring-[#6366f1] ring-offset-2 ring-offset-(--surface-1)'
								: ''} {fc.value === 'transparent' ? 'bg-(--surface-0)' : ''}"
							style={fc.value !== 'transparent' ? `background-color: ${fc.value};` : ''}
							title={fc.label}
							aria-label="{fc.label} fill color"
						>
							{#if fc.value === 'transparent'}
								<span class="h-[1.5px] w-6 rotate-45 bg-rose-500"></span>
							{:else if activeFillColor.toLowerCase() === fc.value.toLowerCase()}
								<span
									class="h-1.5 w-1.5 rounded-full {fc.value === '#ffffff' ||
									fc.value.startsWith('#f')
										? 'bg-black'
										: 'bg-white'}"
								></span>
							{/if}
						</button>
					{/each}

					<!-- Custom Fill Color Picker Button -->
					<label
						class="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-dashed border-(--surface-3) bg-(--surface-2)/40 transition-[transform,border-color,background-color] duration-100 focus-within:ring-2 focus-within:ring-[#6366f1] hover:scale-110 hover:border-[#6366f1] hover:bg-(--surface-2)"
						title="Custom fill color"
						aria-label="Custom fill color"
					>
						<input
							type="color"
							value={activeFillColor.startsWith('#') && activeFillColor.length === 7
								? activeFillColor
								: '#6366f1'}
							oninput={(e) => onSetFillColor((e.target as HTMLInputElement).value)}
							class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
						/>
						<svg
							class="h-3.5 w-3.5 text-(--ink-2)"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<line x1="12" y1="5" x2="12" y2="19" />
							<line x1="5" y1="12" x2="19" y2="12" />
						</svg>
					</label>
				</div>

				{#if isCustomFillColor}
					<div
						class="mt-1 flex items-center justify-between rounded-md border border-(--surface-2) bg-(--surface-0)/70 px-2 py-1"
					>
						<div class="flex items-center gap-1.5">
							<span
								class="h-3 w-3 rounded-full border border-black/40 shadow-xs dark:border-white/30"
								style="background-color: {activeFillColor};"
							></span>
							<span class="font-mono text-[10px] font-medium text-(--ink-1) uppercase"
								>{activeFillColor}</span
							>
						</div>
						<span class="text-[9px] font-medium tracking-wider text-[#6366f1] uppercase"
							>Custom</span
						>
					</div>
				{/if}

				<!-- Fill Pattern Segmented Control -->
				<div class="pt-1">
					<div class="mb-1 text-[9px] font-medium text-(--ink-3) uppercase">Fill Pattern</div>
					<div
						class="flex items-center rounded-lg border border-(--surface-2) bg-(--surface-0) p-0.5"
					>
						{#each FILL_STYLES as fs}
							<button
								onclick={() => onSetFillStyle(fs.value)}
								class="flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium transition-[background-color,color] duration-150 {activeFillStyle ===
								fs.value
									? 'border border-white/5 bg-(--surface-2) text-(--ink-1) shadow-xs'
									: 'text-(--ink-2) hover:bg-(--surface-2)/40 hover:text-(--ink-1)'}"
								title="{fs.label} pattern"
								aria-label="{fs.label} pattern"
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
										<line x1="1" y1="1" x2="11" y2="11" />
									</svg>
								{/if}
								<span class="text-[10px]">{fs.label}</span>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- 3. STROKE WIDTH SECTION -->
		{#if showStrokeWidth}
			<div class="space-y-1.5 border-t border-(--surface-2)/70 pt-2.5">
				<div class="text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">
					Stroke Width
				</div>
				<div
					class="flex items-center rounded-lg border border-(--surface-2) bg-(--surface-0) p-0.5"
				>
					{#each STROKE_WIDTHS as sw}
						<button
							onclick={() => onSetWidth(sw.value)}
							class="flex flex-1 flex-col items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium transition-[background-color,color] duration-150 {activeWidth ===
							sw.value
								? 'border border-white/5 bg-(--surface-2) text-(--ink-1) shadow-xs'
								: 'text-(--ink-2) hover:bg-(--surface-2)/40 hover:text-(--ink-1)'}"
							title="{sw.label} ({sw.value}px)"
							aria-label="{sw.label} stroke width"
						>
							<span
								class="w-6 rounded-full bg-current transition-all"
								style="height: {sw.barHeight}px;"
							></span>
							<span class="text-[9px]">{sw.label}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- 4. STROKE STYLE SECTION -->
			<div class="space-y-1.5 border-t border-(--surface-2)/70 pt-2.5">
				<div class="text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">
					Stroke Style
				</div>
				<div
					class="flex items-center rounded-lg border border-(--surface-2) bg-(--surface-0) p-0.5"
				>
					<button
						onclick={() => onSetStrokeStyle('solid')}
						class="flex flex-1 items-center justify-center rounded-md py-1.5 text-xs font-medium transition-[background-color,color] duration-150 {activeStrokeStyle ===
						'solid'
							? 'border border-white/5 bg-(--surface-2) text-(--ink-1) shadow-xs'
							: 'text-(--ink-2) hover:bg-(--surface-2)/40 hover:text-(--ink-1)'}"
						title="Solid stroke"
						aria-label="Solid stroke"
					>
						<svg
							class="h-3.5 w-8"
							viewBox="0 0 32 8"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<line x1="2" y1="4" x2="30" y2="4" />
						</svg>
					</button>
					<button
						onclick={() => onSetStrokeStyle('dashed')}
						class="flex flex-1 items-center justify-center rounded-md py-1.5 text-xs font-medium transition-[background-color,color] duration-150 {activeStrokeStyle ===
						'dashed'
							? 'border border-white/5 bg-(--surface-2) text-(--ink-1) shadow-xs'
							: 'text-(--ink-2) hover:bg-(--surface-2)/40 hover:text-(--ink-1)'}"
						title="Dashed stroke"
						aria-label="Dashed stroke"
					>
						<svg
							class="h-3.5 w-8"
							viewBox="0 0 32 8"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-dasharray="5 3"
						>
							<line x1="2" y1="4" x2="30" y2="4" />
						</svg>
					</button>
					<button
						onclick={() => onSetStrokeStyle('dotted')}
						class="flex flex-1 items-center justify-center rounded-md py-1.5 text-xs font-medium transition-[background-color,color] duration-150 {activeStrokeStyle ===
						'dotted'
							? 'border border-white/5 bg-(--surface-2) text-(--ink-1) shadow-xs'
							: 'text-(--ink-2) hover:bg-(--surface-2)/40 hover:text-(--ink-1)'}"
						title="Dotted stroke"
						aria-label="Dotted stroke"
					>
						<svg
							class="h-3.5 w-8"
							viewBox="0 0 32 8"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-dasharray="2 3"
							stroke-linecap="round"
						>
							<line x1="2" y1="4" x2="30" y2="4" />
						</svg>
					</button>
				</div>
			</div>
		{/if}

		<!-- 5. CORNERS (ROUNDNESS) SECTION -->
		{#if isRectActive}
			<div class="space-y-1.5 border-t border-(--surface-2)/70 pt-2.5">
				<div class="text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">Edges</div>
				<div
					class="flex items-center rounded-lg border border-(--surface-2) bg-(--surface-0) p-0.5"
				>
					<button
						onclick={() => onSetRoundness('sharp')}
						class="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-[background-color,color] duration-150 {activeRoundness ===
						'sharp'
							? 'border border-white/5 bg-(--surface-2) text-(--ink-1) shadow-xs'
							: 'text-(--ink-2) hover:bg-(--surface-2)/40 hover:text-(--ink-1)'}"
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
						onclick={() => onSetRoundness('round')}
						class="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-[background-color,color] duration-150 {activeRoundness ===
						'round'
							? 'border border-white/5 bg-(--surface-2) text-(--ink-1) shadow-xs'
							: 'text-(--ink-2) hover:bg-(--surface-2)/40 hover:text-(--ink-1)'}"
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

		<!-- 6. ARROW ROUTING SECTION -->
		{#if isArrowActive}
			<div class="space-y-1.5 border-t border-(--surface-2)/70 pt-2.5">
				<div class="text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">
					Arrow Routing
				</div>
				<div
					class="flex items-center rounded-lg border border-(--surface-2) bg-(--surface-0) p-0.5"
				>
					<button
						onclick={() => onSetArrowRouting('orthogonal')}
						class="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-[background-color,color] duration-150 {activeArrowRouting ===
						'orthogonal'
							? 'border border-white/5 bg-(--surface-2) text-(--ink-1) shadow-xs'
							: 'text-(--ink-2) hover:bg-(--surface-2)/40 hover:text-(--ink-1)'}"
						title="Elbow (90° step arrow)"
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
						onclick={() => onSetArrowRouting('straight')}
						class="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-[background-color,color] duration-150 {activeArrowRouting ===
						'straight'
							? 'border border-white/5 bg-(--surface-2) text-(--ink-1) shadow-xs'
							: 'text-(--ink-2) hover:bg-(--surface-2)/40 hover:text-(--ink-1)'}"
						title="Straight arrow"
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

		<!-- 7. TYPOGRAPHY SECTION -->
		{#if isTextActive}
			<div class="space-y-1.5 border-t border-(--surface-2)/70 pt-2.5">
				<div class="text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase">Font</div>
				<div
					class="flex items-center rounded-lg border border-(--surface-2) bg-(--surface-0) p-0.5"
				>
					{#each FONT_FAMILY_OPTIONS as f}
						<button
							onclick={() => onSetFontFamily(f.value)}
							class="flex flex-1 items-center justify-center rounded-md py-1.5 text-xs font-medium transition-[background-color,color] duration-150 {activeFontFamily ===
							f.value
								? 'border border-white/5 bg-(--surface-2) text-(--ink-1) shadow-xs'
								: 'text-(--ink-2) hover:bg-(--surface-2)/40 hover:text-(--ink-1)'}"
							title="{f.label} font"
							style="font-family: {f.css};"
						>
							{f.label}
						</button>
					{/each}
				</div>
				<div
					class="flex items-center rounded-lg border border-(--surface-2) bg-(--surface-0) p-0.5"
				>
					{#each FONT_SIZES as s}
						<button
							onclick={() => onSetFontSize(s.value)}
							class="flex flex-1 items-center justify-center rounded-md py-1.5 text-xs font-medium transition-[background-color,color] duration-150 {activeFontSize ===
							s.value
								? 'border border-white/5 bg-(--surface-2) text-(--ink-1) shadow-xs'
								: 'text-(--ink-2) hover:bg-(--surface-2)/40 hover:text-(--ink-1)'}"
							title={s.title}
						>
							{s.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- 8. OPACITY SECTION -->
		<div class="space-y-1.5 border-t border-(--surface-2)/70 pt-2.5">
			<div
				class="flex items-center justify-between text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase"
			>
				<span>Opacity</span>
				<span class="font-mono text-[10px] font-medium text-(--ink-1)"
					>{Math.round(activeOpacity * 100)}%</span
				>
			</div>
			<input
				type="range"
				min="10"
				max="100"
				step="5"
				value={Math.round(activeOpacity * 100)}
				oninput={(e) => onSetOpacity(Number((e.target as HTMLInputElement).value) / 100)}
				class="h-1.5 w-full cursor-pointer accent-[#6366f1]"
			/>
			<div class="flex items-center rounded-lg border border-(--surface-2) bg-(--surface-0) p-0.5">
				{#each OPACITY_PRESETS as op}
					<button
						onclick={() => onSetOpacity(op.value)}
						class="flex flex-1 items-center justify-center rounded-md py-1 font-mono text-[10px] font-medium transition-[background-color,color] duration-150 {Math.abs(
							activeOpacity - op.value
						) < 0.05
							? 'border border-white/5 bg-(--surface-2) font-bold text-(--ink-1) shadow-xs'
							: 'text-(--ink-2) hover:bg-(--surface-2)/40 hover:text-(--ink-1)'}"
					>
						{op.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- 9. SELECTION ACTIONS & LAYERS -->
		{#if selectedCount > 0}
			<div class="space-y-2 border-t border-(--surface-2)/70 pt-2.5">
				<div
					class="flex items-center justify-between text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase"
				>
					<span>Layer Order</span>
				</div>
				<div class="grid grid-cols-4 gap-1">
					<!-- Bring to Front -->
					<button
						onclick={() => engine?.bringToFront()}
						class="flex flex-col items-center justify-center gap-1 rounded-md border border-(--surface-2) bg-(--surface-0) py-1.5 text-(--ink-2) transition-[background-color,color,border-color,transform] duration-100 ease-out hover:border-(--surface-3) hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none focus-visible:ring-1 focus-visible:ring-[#6366f1] active:scale-95"
						title="Bring to Front (Ctrl+])"
						aria-label="Bring to front"
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polyline points="18 15 12 9 6 15" />
							<line x1="6" y1="5" x2="18" y2="5" />
						</svg>
						<span class="text-[9px] font-medium">To Front</span>
					</button>

					<!-- Bring Forward -->
					<button
						onclick={() => engine?.bringForward()}
						class="flex flex-col items-center justify-center gap-1 rounded-md border border-(--surface-2) bg-(--surface-0) py-1.5 text-(--ink-2) transition-[background-color,color,border-color,transform] duration-100 ease-out hover:border-(--surface-3) hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none focus-visible:ring-1 focus-visible:ring-[#6366f1] active:scale-95"
						title="Bring Forward (])"
						aria-label="Bring forward"
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polyline points="18 15 12 9 6 15" />
						</svg>
						<span class="text-[9px] font-medium">Forward</span>
					</button>

					<!-- Send Backward -->
					<button
						onclick={() => engine?.sendBackward()}
						class="flex flex-col items-center justify-center gap-1 rounded-md border border-(--surface-2) bg-(--surface-0) py-1.5 text-(--ink-2) transition-[background-color,color,border-color,transform] duration-100 ease-out hover:border-(--surface-3) hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none focus-visible:ring-1 focus-visible:ring-[#6366f1] active:scale-95"
						title="Send Backward ([)"
						aria-label="Send backward"
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polyline points="6 9 12 15 18 9" />
						</svg>
						<span class="text-[9px] font-medium">Backward</span>
					</button>

					<!-- Send to Back -->
					<button
						onclick={() => engine?.sendToBack()}
						class="flex flex-col items-center justify-center gap-1 rounded-md border border-(--surface-2) bg-(--surface-0) py-1.5 text-(--ink-2) transition-[background-color,color,border-color,transform] duration-100 ease-out hover:border-(--surface-3) hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none focus-visible:ring-1 focus-visible:ring-[#6366f1] active:scale-95"
						title="Send to Back (Ctrl+[)"
						aria-label="Send to back"
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polyline points="6 9 12 15 18 9" />
							<line x1="6" y1="19" x2="18" y2="19" />
						</svg>
						<span class="text-[9px] font-medium">To Back</span>
					</button>
				</div>

				<div class="grid grid-cols-3 gap-1 pt-1">
					<!-- Duplicate -->
					<button
						onclick={() => engine?.duplicateSelected()}
						class="flex items-center justify-center gap-1 rounded-md border border-(--surface-2) bg-(--surface-0) py-1.5 text-(--ink-2) transition-[background-color,color,border-color,transform] duration-100 ease-out hover:border-(--surface-3) hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none focus-visible:ring-1 focus-visible:ring-[#6366f1] active:scale-95"
						title="Duplicate [Ctrl+D]"
						aria-label="Duplicate selected items"
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
						</svg>
						<span class="text-[10px] font-medium">Clone</span>
					</button>

					<!-- Copy -->
					<button
						onclick={() => engine?.copySelected()}
						class="flex items-center justify-center gap-1 rounded-md border border-(--surface-2) bg-(--surface-0) py-1.5 text-(--ink-2) transition-[background-color,color,border-color,transform] duration-100 ease-out hover:border-(--surface-3) hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none focus-visible:ring-1 focus-visible:ring-[#6366f1] active:scale-95"
						title="Copy [Ctrl+C]"
						aria-label="Copy selected items"
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
						</svg>
						<span class="text-[10px] font-medium">Copy</span>
					</button>

					<!-- Delete -->
					<button
						onclick={onDelete}
						class="flex items-center justify-center gap-1 rounded-md border border-rose-500/20 bg-rose-500/5 py-1.5 text-rose-400 transition-[background-color,color,border-color,transform] duration-100 ease-out hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 active:scale-95"
						title="Delete Selection ({selectedCount}) [Backspace]"
						aria-label="Delete selected items"
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M3 6h18" />
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
							<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
						</svg>
						<span class="text-[10px] font-medium">Delete</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}
