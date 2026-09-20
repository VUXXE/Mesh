<script lang="ts">
	import type { CurrentUser, ConnectionStatus } from '$lib/client/websocket.svelte';
	import type { GridMode, PeerPresence } from '$lib/types';
	import type { CanvasEngine } from '$lib/client/canvas-engine';

	interface Props {
		roomId: string;
		status: ConnectionStatus;
		currentUser: CurrentUser;
		peers: PeerPresence[];
		locked?: boolean;
		engine: CanvasEngine | null;
		onUpdateUserName: (name: string) => void;
		onUpdateUserColor?: (color: string) => void;
	}

	let {
		roomId,
		status,
		currentUser,
		peers,
		locked = false,
		engine,
		onUpdateUserName,
		onUpdateUserColor
	}: Props = $props();

	const COLOR_PALETTE = [
		'#f87171', // red
		'#fb923c', // orange
		'#facc15', // yellow
		'#4ade80', // green
		'#22d3ee', // cyan
		'#818cf8', // indigo
		'#c084fc', // purple
		'#f472b6' // pink
	];

	let isLight = $state(false);

	function toggleTheme() {
		isLight = !isLight;
		if (typeof document !== 'undefined') {
			document.documentElement.classList.toggle('light', isLight);
		}
		try {
			localStorage.setItem('mesh_theme', isLight ? 'light' : 'dark');
		} catch {
			// Ignore storage errors (private mode, etc.)
		}
		engine?.applyTheme();
	}

	let showGridMenu = $state(false);
	let gridMode = $state<GridMode>('dots');
	let snapToGrid = $state(false);

	let gridHudMessage = $state<string | null>(null);
	let hudTimer: ReturnType<typeof setTimeout> | null = null;

	function showGridHud(msg: string) {
		gridHudMessage = msg;
		if (hudTimer) clearTimeout(hudTimer);
		hudTimer = setTimeout(() => {
			gridHudMessage = null;
		}, 1800);
	}

	function toggleGridMenu() {
		if (!showGridMenu) {
			showProfileMenu = false;
		}
		showGridMenu = !showGridMenu;
	}

	$effect(() => {
		if (engine) {
			gridMode = engine.gridMode;
			snapToGrid = engine.snapToGrid;
			engine.onGridModeChanged = (mode) => {
				gridMode = mode;
				showGridHud(
					`Grid: ${mode === 'none' ? 'Disabled' : mode === 'dots' ? 'Dots (32px)' : 'Lines (32px)'}`
				);
			};
			engine.onSnapToGridChanged = (snap) => {
				snapToGrid = snap;
				showGridHud(`Snap to Grid: ${snap ? 'ON' : 'OFF'}`);
			};
		}
	});

	$effect(() => {
		if (engine && typeof document !== 'undefined') {
			isLight = document.documentElement.classList.contains('light');
		}
	});

	let copiedCode = $state(false);
	let copiedLink = $state(false);

	// Profile editing state
	let showProfileMenu = $state(false);
	let nameInput = $state('');
	let selectedColor = $state('');
	let nameInputEl: HTMLInputElement | null = $state(null);

	function copyRoomCode() {
		if (typeof window === 'undefined') return;
		navigator.clipboard.writeText(roomId);
		copiedCode = true;
		setTimeout(() => {
			copiedCode = false;
		}, 2000);
	}

	function copyRoomLink() {
		if (typeof window === 'undefined') return;
		navigator.clipboard.writeText(window.location.href);
		copiedLink = true;
		setTimeout(() => {
			copiedLink = false;
		}, 2000);
	}

	function openProfileMenu() {
		showGridMenu = false;
		nameInput = currentUser.name;
		selectedColor = currentUser.color;
		showProfileMenu = true;
		setTimeout(() => {
			nameInputEl?.focus();
			nameInputEl?.select();
		}, 20);
	}

	function closeProfileMenu() {
		showProfileMenu = false;
		nameInput = currentUser.name;
		selectedColor = currentUser.color;
	}

	function saveProfile() {
		const trimmed = nameInput.trim();
		if (trimmed && trimmed !== currentUser.name) {
			onUpdateUserName(trimmed);
		}
		if (selectedColor && selectedColor !== currentUser.color) {
			onUpdateUserColor?.(selectedColor);
		}
		showProfileMenu = false;
	}

	function handleProfileKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveProfile();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			closeProfileMenu();
		}
	}

	function getInitials(name: string): string {
		if (!name) return '?';
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		}
		return name.substring(0, 2).toUpperCase();
	}
</script>

<div class="fixed top-4 right-4 z-20 flex items-center gap-2 select-none">
	<!-- 1. Room & Share Pill (Integrated Live status + Room code + Share button) -->
	<div
		class="flex h-9 items-center gap-2 rounded-lg border border-(--surface-2) bg-(--surface-1) px-2.5 shadow-lg backdrop-blur-md"
	>
		<!-- Integrated Connection Status Dot -->
		<div
			class="flex items-center"
			title="Status: {status === 'connected'
				? 'Live sync'
				: status === 'reconnecting'
					? 'Reconnecting...'
					: 'Offline'}"
		>
			{#if status === 'connected'}
				<span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-xs"></span>
			{:else if status === 'connecting' || status === 'reconnecting'}
				<span class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500 shadow-xs"></span>
			{:else}
				<span class="h-2 w-2 shrink-0 rounded-full bg-rose-500 shadow-xs"></span>
			{/if}
		</div>

		<!-- Password Lock indicator if protected -->
		{#if locked}
			<svg
				class="h-3.5 w-3.5 shrink-0 text-amber-300"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<title>Password protected room</title>
				<rect x="3" y="11" width="18" height="11" rx="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
		{/if}

		<!-- Clickable Room Code (copies code) -->
		<button
			onclick={copyRoomCode}
			class="font-mono text-xs font-semibold text-(--ink-1) transition-colors hover:text-[#6366f1] focus:outline-none"
			title="Click to copy room code ({roomId})"
		>
			{copiedCode ? 'Copied!' : roomId}
		</button>

		<div class="h-3.5 w-px bg-(--surface-2)"></div>

		<!-- Clean One-Click Share Button (copies link) -->
		<button
			onclick={copyRoomLink}
			class="flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-all focus:outline-none {copiedLink
				? 'bg-emerald-500/20 text-emerald-300'
				: 'bg-[#6366f1]/15 text-[#818cf8] hover:bg-[#6366f1]/25 hover:text-white'}"
			title="Copy invite link to clipboard"
		>
			<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				{#if copiedLink}
					<polyline points="20 6 9 17 4 12" />
				{:else}
					<circle cx="18" cy="5" r="3" />
					<circle cx="6" cy="12" r="3" />
					<circle cx="18" cy="19" r="3" />
					<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
					<line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
				{/if}
			</svg>
			<span>{copiedLink ? 'Copied' : 'Share'}</span>
		</button>
	</div>

	<!-- 2. Canvas View Controls (Unified Grid Mode + Theme Toggle Pill) -->
	<div
		class="relative flex h-9 items-center rounded-lg border border-(--surface-2) bg-(--surface-1) p-0.5 shadow-lg backdrop-blur-md"
	>
		<!-- Grid Mode & Status Indicator Button -->
		<button
			onclick={toggleGridMenu}
			class="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus:outline-none {showGridMenu
				? 'bg-(--surface-2) text-(--ink-1)'
				: gridMode !== 'none'
					? 'text-(--ink-1) hover:bg-(--surface-2)'
					: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
			title="Grid: {gridMode} {snapToGrid ? '(Snap On)' : ''} (Click to configure)"
			aria-label="Grid settings"
		>
			<!-- Active Grid Mode Icon -->
			<span class={gridMode !== 'none' ? 'text-[#818cf8]' : 'text-(--ink-3)'}>
				{#if gridMode === 'dots'}
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
						<circle cx="5" cy="5" r="1.5" />
						<circle cx="12" cy="5" r="1.5" />
						<circle cx="19" cy="5" r="1.5" />
						<circle cx="5" cy="12" r="1.5" />
						<circle cx="12" cy="12" r="1.5" />
						<circle cx="19" cy="12" r="1.5" />
						<circle cx="5" cy="19" r="1.5" />
						<circle cx="12" cy="19" r="1.5" />
						<circle cx="19" cy="19" r="1.5" />
					</svg>
				{:else if gridMode === 'lines'}
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<rect x="3" y="3" width="18" height="18" rx="2" />
						<line x1="3" y1="12" x2="21" y2="12" />
						<line x1="12" y1="3" x2="12" y2="21" />
					</svg>
				{:else}
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3" />
						<line x1="4" y1="4" x2="20" y2="20" />
					</svg>
				{/if}
			</span>

			<!-- Explicit Text Label -->
			<span class="text-xs font-medium {gridMode === 'none' ? 'text-(--ink-3)' : 'text-(--ink-1)'}">
				{gridMode === 'dots' ? 'Dots' : gridMode === 'lines' ? 'Lines' : 'Grid Off'}
			</span>

			<!-- Snap to Grid Indicator Badge -->
			{#if snapToGrid}
				<span
					class="flex items-center gap-0.5 rounded bg-[#6366f1]/20 px-1 py-0.5 text-[9px] font-bold text-[#818cf8]"
					title="Snap to grid is active"
				>
					<svg
						class="h-2.5 w-2.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<path d="M6 3v7a6 6 0 0 0 12 0V3" />
						<line x1="4" y1="7" x2="8" y2="7" />
						<line x1="16" y1="7" x2="20" y2="7" />
					</svg>
					<span>Snap</span>
				</span>
			{/if}

			<!-- Dropdown Chevron -->
			<svg
				class="h-3 w-3 text-(--ink-3) transition-transform duration-150 {showGridMenu
					? 'rotate-180 text-(--ink-1)'
					: ''}"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
			>
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</button>

		<div class="h-4 w-px bg-(--surface-2)"></div>

		<!-- Theme Toggle Button -->
		<button
			onclick={toggleTheme}
			class="flex h-8 w-8 items-center justify-center rounded-md text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none"
			title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
			aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
		>
			{#if isLight}
				<svg
					class="h-3.5 w-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2" />
					<path d="M12 20v2" />
					<path d="M4.93 4.93l1.41 1.41" />
					<path d="M17.66 17.66l1.41 1.41" />
					<path d="M2 12h2" />
					<path d="M20 12h2" />
					<path d="M6.34 17.66l-1.41 1.41" />
					<path d="M19.07 4.93l-1.41 1.41" />
				</svg>
			{:else}
				<svg
					class="h-3.5 w-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			{/if}
		</button>

		<!-- Grid Popover Dropdown -->
		{#if showGridMenu}
			<button
				type="button"
				class="fixed inset-0 z-40 cursor-default bg-transparent focus:outline-none"
				onclick={() => (showGridMenu = false)}
				tabindex="-1"
				aria-label="Close grid menu"
			></button>

			<div
				class="absolute top-full right-0 z-50 mt-2 w-56 rounded-xl border border-(--surface-2) bg-(--surface-1) p-3 shadow-xl backdrop-blur-md"
			>
				<div class="mb-2.5 flex items-center justify-between px-1">
					<span class="text-[10px] font-semibold tracking-wider text-(--ink-3) uppercase"
						>Grid Settings</span
					>
					<span
						class="rounded bg-[#6366f1]/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#818cf8] capitalize"
					>
						{gridMode}
						{snapToGrid ? '• Snap' : ''}
					</span>
				</div>

				<!-- 3-Segment Grid Pattern Selector -->
				<div
					class="grid grid-cols-3 gap-1.5 rounded-lg border border-(--surface-2) bg-(--surface-0)/80 p-1.5"
				>
					<button
						onclick={() => {
							engine?.setGridMode('dots');
							gridMode = 'dots';
						}}
						class="relative flex flex-col items-center gap-1 rounded-md py-2 text-[11px] font-medium transition-all focus:outline-none {gridMode ===
						'dots'
							? 'bg-[#6366f1] font-semibold text-white shadow-xs'
							: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
						title="Dot matrix grid (32px spacing)"
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
							<circle cx="6" cy="6" r="2" />
							<circle cx="18" cy="6" r="2" />
							<circle cx="6" cy="18" r="2" />
							<circle cx="18" cy="18" r="2" />
						</svg>
						<span>Dots</span>
						{#if gridMode === 'dots'}
							<span
								class="rounded-full bg-white/25 px-1 text-[8px] font-bold tracking-wide uppercase"
								>Active</span
							>
						{/if}
					</button>

					<button
						onclick={() => {
							engine?.setGridMode('lines');
							gridMode = 'lines';
						}}
						class="relative flex flex-col items-center gap-1 rounded-md py-2 text-[11px] font-medium transition-all focus:outline-none {gridMode ===
						'lines'
							? 'bg-[#6366f1] font-semibold text-white shadow-xs'
							: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
						title="Squared lines grid (graph paper)"
					>
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="3" y="3" width="18" height="18" rx="2" />
							<line x1="3" y1="12" x2="21" y2="12" />
							<line x1="12" y1="3" x2="12" y2="21" />
						</svg>
						<span>Lines</span>
						{#if gridMode === 'lines'}
							<span
								class="rounded-full bg-white/25 px-1 text-[8px] font-bold tracking-wide uppercase"
								>Active</span
							>
						{/if}
					</button>

					<button
						onclick={() => {
							engine?.setGridMode('none');
							gridMode = 'none';
						}}
						class="relative flex flex-col items-center gap-1 rounded-md py-2 text-[11px] font-medium transition-all focus:outline-none {gridMode ===
						'none'
							? 'bg-[#6366f1] font-semibold text-white shadow-xs'
							: 'text-(--ink-2) hover:bg-(--surface-2) hover:text-(--ink-1)'}"
						title="Clean blank canvas"
					>
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3" />
							<line x1="4" y1="4" x2="20" y2="20" />
						</svg>
						<span>None</span>
						{#if gridMode === 'none'}
							<span
								class="rounded-full bg-white/25 px-1 text-[8px] font-bold tracking-wide uppercase"
								>Active</span
							>
						{/if}
					</button>
				</div>

				<div class="my-2.5 h-px bg-(--surface-2)"></div>

				<!-- Snap to Grid Toggle -->
				<button
					onclick={() => {
						const nextSnap = !snapToGrid;
						engine?.setSnapToGrid(nextSnap);
						snapToGrid = nextSnap;
					}}
					class="flex w-full items-center justify-between rounded-lg p-2 text-xs text-(--ink-1) transition-colors hover:bg-(--surface-2)"
				>
					<div class="flex items-center gap-2">
						<svg
							class="h-4 w-4 {snapToGrid ? 'text-[#818cf8]' : 'text-(--ink-3)'}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M6 3v7a6 6 0 0 0 12 0V3" />
							<line x1="4" y1="7" x2="8" y2="7" />
							<line x1="16" y1="7" x2="20" y2="7" />
						</svg>
						<div class="text-left">
							<div class="text-xs font-medium">Snap to Grid</div>
							<div class="text-[10px] text-(--ink-3)">32px alignment interval</div>
						</div>
					</div>
					<div class="flex items-center gap-1.5">
						<span
							class="rounded px-1.5 py-0.5 text-[10px] font-bold {snapToGrid
								? 'bg-[#6366f1]/20 text-[#818cf8]'
								: 'bg-(--surface-3) text-(--ink-3)'}"
						>
							{snapToGrid ? 'ON' : 'OFF'}
						</span>
						<div
							class="flex h-5 w-8 items-center rounded-full p-0.5 transition-colors {snapToGrid
								? 'justify-end bg-[#6366f1]'
								: 'justify-start bg-(--surface-3)'}"
						>
							<div class="h-4 w-4 rounded-full bg-white shadow-xs"></div>
						</div>
					</div>
				</button>

				<div class="mt-2 flex items-center justify-between px-1 text-[10px] text-(--ink-3)">
					<span>Shortcut</span>
					<kbd
						class="rounded border border-(--surface-3) bg-(--surface-0) px-1.5 py-0.5 font-mono text-[9px] text-(--ink-2)"
						>Ctrl + '</kbd
					>
				</div>
			</div>
		{/if}
	</div>

	<!-- 3. Collaboration & Presence Pill (Peers + You) -->
	<div
		class="relative flex h-9 items-center gap-1.5 rounded-lg border border-(--surface-2) bg-(--surface-1) px-2 shadow-lg backdrop-blur-md"
	>
		<!-- Connected Peer Avatars -->
		{#if peers.length > 0}
			<div class="flex items-center -space-x-1.5 overflow-hidden">
				{#each peers as peer (peer.userId)}
					<div
						class="flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full border-2 border-(--surface-1) text-[10px] font-bold text-black shadow-sm"
						style="background-color: {peer.color};"
						title={peer.name}
					>
						{getInitials(peer.name)}
					</div>
				{/each}
			</div>
			<div class="mx-0.5 h-3.5 w-px bg-(--surface-2)"></div>
		{/if}

		<!-- Local Current User Trigger Button -->
		<button
			onclick={openProfileMenu}
			class="flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-(--surface-2) focus:outline-none {showProfileMenu
				? 'bg-(--surface-2)'
				: ''}"
			title="Click to edit your profile and cursor color"
			aria-label="Edit your profile"
		>
			<div
				class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black/15 text-[10px] font-bold text-black shadow-2xs transition-colors dark:border-white/20"
				style="background-color: {currentUser.color};"
			>
				{getInitials(currentUser.name)}
			</div>

			<span class="max-w-[80px] truncate text-xs font-medium text-(--ink-1)">
				{currentUser.name}
			</span>

			<svg
				class="h-3 w-3 text-(--ink-3) transition-transform duration-150 {showProfileMenu
					? 'rotate-180 text-(--ink-1)'
					: ''}"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
			>
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</button>

		<!-- Profile Popover Dropdown -->
		{#if showProfileMenu}
			<button
				type="button"
				class="fixed inset-0 z-40 cursor-default bg-transparent focus:outline-none"
				onclick={closeProfileMenu}
				tabindex="-1"
				aria-label="Close profile menu"
			></button>

			<div
				class="absolute top-full right-0 z-50 mt-2 w-72 rounded-xl border border-(--surface-2) bg-(--surface-1) p-3.5 shadow-2xl backdrop-blur-md"
			>
				<!-- Popover Header -->
				<div class="mb-3 flex items-center justify-between">
					<div class="flex items-center gap-1.5">
						<svg
							class="h-4 w-4 text-[#818cf8]"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
							<circle cx="12" cy="7" r="4" />
						</svg>
						<span class="text-xs font-semibold text-(--ink-1)">Edit Profile</span>
					</div>
					<button
						type="button"
						onclick={closeProfileMenu}
						class="rounded p-1 text-(--ink-3) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none"
						aria-label="Close"
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>

				<!-- Live Preview Card -->
				<div
					class="mb-3 flex items-center gap-2.5 rounded-lg border border-(--surface-2) bg-(--surface-0)/70 p-2.5"
				>
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/15 text-xs font-bold text-black shadow-xs transition-colors dark:border-white/20"
						style="background-color: {selectedColor || currentUser.color};"
					>
						{getInitials(nameInput || currentUser.name)}
					</div>
					<div class="min-w-0 flex-1">
						<div class="truncate text-xs font-semibold text-(--ink-1)">
							{nameInput.trim() || currentUser.name}
						</div>
						<div class="flex items-center gap-1.5 text-[10px] text-(--ink-3)">
							<span
								class="h-1.5 w-1.5 rounded-full"
								style="background-color: {selectedColor || currentUser.color};"
							></span>
							<span>Live cursor & presence</span>
						</div>
					</div>
				</div>

				<!-- Name Input -->
				<div class="mb-3 space-y-1">
					<label for="profile-name-input" class="block text-[11px] font-medium text-(--ink-2)">
						Display Name
					</label>
					<input
						id="profile-name-input"
						type="text"
						bind:this={nameInputEl}
						bind:value={nameInput}
						onkeydown={handleProfileKeyDown}
						maxlength={32}
						placeholder="Enter your name"
						class="w-full rounded-lg border border-(--surface-2) bg-(--surface-0) px-2.5 py-1.5 text-xs text-(--ink-1) placeholder-(--ink-3) transition-colors focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] focus:outline-none"
					/>
				</div>

				<!-- Color Palette Picker -->
				<div class="mb-4 space-y-1.5">
					<span class="block text-[11px] font-medium text-(--ink-2)"> Presence Color </span>
					<div class="grid grid-cols-8 gap-1.5">
						{#each COLOR_PALETTE as color}
							<button
								type="button"
								onclick={() => (selectedColor = color)}
								class="relative flex h-6 w-6 items-center justify-center rounded-full border border-black/15 transition-transform hover:scale-110 focus:outline-none dark:border-white/20 {selectedColor ===
								color
									? 'scale-110 ring-2 ring-[#6366f1] ring-offset-1 ring-offset-(--surface-1)'
									: 'hover:opacity-90'}"
								style="background-color: {color};"
								title="Choose color"
								aria-label="Color {color}"
							>
								{#if selectedColor === color}
									<svg
										class="h-3 w-3 text-black"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="3"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-between border-t border-(--surface-2) pt-2.5">
					<span class="text-[10px] text-(--ink-3)">Press ↵ Enter</span>
					<div class="flex items-center gap-1.5">
						<button
							type="button"
							onclick={closeProfileMenu}
							class="rounded-md px-2.5 py-1 text-xs font-medium text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none"
						>
							Cancel
						</button>
						<button
							type="button"
							onclick={saveProfile}
							disabled={!nameInput.trim()}
							class="rounded-md bg-[#6366f1] px-3 py-1 text-xs font-medium text-white shadow-xs transition-colors hover:bg-[#4f46e5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							Save
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Floating Real-Time Grid HUD Notification -->
{#if gridHudMessage}
	<div
		class="animate-in fade-in zoom-in-95 fixed top-16 right-4 z-30 flex items-center gap-2 rounded-lg border border-(--surface-2) bg-(--surface-1)/95 px-3 py-1.5 text-xs font-medium text-(--ink-1) shadow-xl backdrop-blur-md transition-all duration-150"
	>
		<span class="h-2 w-2 shrink-0 rounded-full {snapToGrid ? 'bg-[#818cf8]' : 'bg-emerald-400'}"
		></span>
		<span>{gridHudMessage}</span>
	</div>
{/if}
