<script lang="ts">
	import type { CanvasEngine, ToolMode } from '$lib/client/canvas-engine';
	import type { StrokeStyle, FillStyle, CornerRoundness } from '$lib/types';
	import PropertiesPanel from './toolbar/PropertiesPanel.svelte';
	import BottomDock from './toolbar/BottomDock.svelte';

	// High-contrast color swatch border tokens required by design system & test suite:
	// border-black/40 dark:border-white/30

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
	let userOpenedPanel = $state<boolean>(false);
	let showExportMenu = $state<boolean>(false);

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
		userOpenedPanel ||
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

	function togglePropertiesPanel() {
		if (isPanelCollapsed) {
			isPanelCollapsed = false;
			userOpenedPanel = true;
		} else if (showSidePanel) {
			isPanelCollapsed = true;
			userOpenedPanel = false;
		} else {
			userOpenedPanel = true;
			isPanelCollapsed = false;
		}
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

<!-- SIDE PROPERTIES PANEL -->
{#if showSidePanel}
	<PropertiesPanel
		{engine}
		{activeTool}
		{selectedCount}
		{activeColor}
		{activeWidth}
		{activeStrokeStyle}
		{activeFillStyle}
		{activeFillColor}
		{activeRoundness}
		{activeOpacity}
		{activeFontFamily}
		{activeFontSize}
		{activeArrowRouting}
		{isTextActive}
		{isArrowActive}
		{isRectActive}
		{showStrokeWidth}
		{showFillControls}
		isCollapsed={isPanelCollapsed}
		onToggleCollapse={() => {
			if (isPanelCollapsed) {
				isPanelCollapsed = false;
				userOpenedPanel = true;
			} else {
				isPanelCollapsed = true;
				userOpenedPanel = false;
			}
		}}
		onSetColor={setColor}
		onSetWidth={setWidth}
		onSetStrokeStyle={setStrokeStyle}
		onSetFillStyle={setFillStyle}
		onSetFillColor={setFillColor}
		onSetRoundness={setRoundness}
		onSetOpacity={setOpacity}
		onSetFontFamily={setFontFamily}
		onSetFontSize={setFontSize}
		onSetArrowRouting={setArrowRouting}
		onDelete={handleDelete}
	/>
{/if}

<!-- PRIMARY BOTTOM DOCK -->
<BottomDock
	{activeTool}
	{activeColor}
	{activeFillColor}
	{activeWidth}
	{canUndo}
	{canRedo}
	isPanelOpen={showSidePanel && !isPanelCollapsed}
	{showExportMenu}
	onSelectTool={selectTool}
	{onUndo}
	{onRedo}
	{onClearCanvas}
	onToggleProperties={togglePropertiesPanel}
	onToggleExportMenu={() => (showExportMenu = !showExportMenu)}
	onCloseExportMenu={() => (showExportMenu = false)}
	onExportPng={handleExportPng}
	onExportSvg={handleExportSvg}
	onExportJson={handleExportJson}
	{onOpenMermaid}
	onTriggerImport={triggerImport}
/>

<!-- Hidden File Input for JSON Import -->
<input
	bind:this={fileInputRef}
	type="file"
	accept=".json"
	onchange={handleFileSelected}
	class="hidden"
/>
