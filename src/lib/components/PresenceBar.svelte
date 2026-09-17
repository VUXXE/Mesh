<script lang="ts">
	import type { CurrentUser, ConnectionStatus } from '$lib/client/websocket.svelte';
	import type { PeerPresence } from '$lib/types';
	import type { CanvasEngine } from '$lib/client/canvas-engine';

	interface Props {
		status: ConnectionStatus;
		currentUser: CurrentUser;
		peers: PeerPresence[];
		engine: CanvasEngine | null;
		onUpdateUserName: (name: string) => void;
	}

	let {
		status,
		currentUser,
		peers,
		engine,
		onUpdateUserName
	}: Props = $props();

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

	$effect(() => {
		if (engine && typeof document !== 'undefined') {
			isLight = document.documentElement.classList.contains('light');
		}
	});

	let isEditingName = $state(false);
	let nameInput = $state('');

	$effect(() => {
		nameInput = currentUser.name;
	});

	function saveName() {
		isEditingName = false;
		if (nameInput.trim() && nameInput.trim() !== currentUser.name) {
			onUpdateUserName(nameInput.trim());
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') saveName();
		if (e.key === 'Escape') {
			nameInput = currentUser.name;
			isEditingName = false;
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
	<!-- Unified Presence, Peer Stack & User Bar -->
	<div
		class="flex h-9 items-center gap-2 rounded-lg border border-(--surface-2) bg-(--surface-1)/90 px-2.5 shadow-sm backdrop-blur-md"
	>
		<!-- Connected Peer Avatars Stack -->
		{#if peers.length > 0}
			<div class="flex items-center -space-x-1.5 overflow-hidden py-0.5">
				{#each peers as peer (peer.userId)}
					<div
						class="flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full border-2 border-(--surface-1) text-[10px] font-bold text-black shadow-xs ring-1 ring-black/10"
						style="background-color: {peer.color};"
						title={peer.name}
					>
						{getInitials(peer.name)}
					</div>
				{/each}
			</div>
			<div class="h-3.5 w-px bg-(--surface-2)"></div>
		{/if}

		<!-- Current User Name with Avatar -->
		<div class="flex items-center gap-1.5">
			<div
				class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-black shadow-xs ring-1 ring-white/20"
				style="background-color: {currentUser.color};"
				title="Your avatar"
			>
				{getInitials(currentUser.name)}
			</div>

			{#if isEditingName}
				<input
					type="text"
					bind:value={nameInput}
					onblur={saveName}
					onkeydown={handleKeyDown}
					class="h-6 w-24 rounded border border-[#6366f1] bg-(--surface-0) px-1.5 text-xs text-(--ink-1) focus:outline-none"
				/>
			{:else}
				<button
					type="button"
					onclick={() => (isEditingName = true)}
					class="max-w-[110px] truncate text-xs font-medium text-(--ink-1) transition-colors hover:text-[#6366f1] focus:outline-none"
					title="Click to edit your display name"
				>
					{currentUser.name}
				</button>
			{/if}
		</div>

		<div class="h-3.5 w-px bg-(--surface-2)"></div>

		<!-- Live Connection Dot & Status -->
		<div class="flex items-center gap-1.5 pr-0.5">
			{#if status === 'connected'}
				<span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500"></span>
				<span class="text-xs font-medium text-(--ink-2)">Live</span>
			{:else if status === 'connecting' || status === 'reconnecting'}
				<span class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500"></span>
				<span class="text-xs font-medium text-amber-400">Reconnecting...</span>
			{:else}
				<span class="h-2 w-2 shrink-0 rounded-full bg-rose-500"></span>
				<span class="text-xs font-medium text-rose-400">Offline</span>
			{/if}
		</div>
	</div>

	<!-- Ghost Theme Toggle Button -->
	<button
		type="button"
		onclick={toggleTheme}
		class="group flex h-9 w-9 items-center justify-center rounded-lg border border-(--surface-2) bg-(--surface-1)/90 text-(--ink-2) shadow-sm backdrop-blur-md transition-all hover:bg-(--surface-2) hover:text-(--ink-1)"
		title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
		aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
	>
		{#if isLight}
			<svg
				class="h-4 w-4 transition-transform duration-300 group-hover:-rotate-12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
			</svg>
		{:else}
			<svg
				class="h-4 w-4 transition-transform duration-300 group-hover:rotate-45"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="12" cy="12" r="5"></circle>
				<line x1="12" y1="1" x2="12" y2="3"></line>
				<line x1="12" y1="21" x2="12" y2="23"></line>
				<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
				<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
				<line x1="1" y1="12" x2="3" y2="12"></line>
				<line x1="21" y1="12" x2="23" y2="12"></line>
				<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
				<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
			</svg>
		{/if}
	</button>
</div>
