<script lang="ts">
	import type { CurrentUser, ConnectionStatus } from '$lib/client/websocket.svelte';
	import type { PeerPresence } from '$lib/types';

	interface Props {
		roomId: string;
		status: ConnectionStatus;
		currentUser: CurrentUser;
		peers: PeerPresence[];
		locked?: boolean;
		onUpdateUserName: (name: string) => void;
	}

	let { roomId, status, currentUser, peers, locked = false, onUpdateUserName }: Props = $props();

	let copiedCode = $state(false);
	let copiedLink = $state(false);
	let isEditingName = $state(false);
	let nameInput = $state('');

	$effect(() => {
		nameInput = currentUser.name;
	});

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
	<!-- Room ID & Copy Options Pill -->
	<div
		class="flex items-center gap-1.5 rounded-lg border border-(--surface-2) bg-(--surface-1) px-3 py-1.5 shadow-lg backdrop-blur-md"
	>
		<span class="text-xs text-(--ink-2)">Room:</span>
		{#if locked}
			<svg
				class="h-3.5 w-3.5 text-amber-300"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<title>Password protected</title>
				<rect x="3" y="11" width="18" height="11" rx="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
		{/if}
		<button
			onclick={copyRoomCode}
			class="font-mono text-xs font-semibold text-(--ink-1) transition-colors hover:text-[#6366f1] focus:outline-none"
			title="Click to copy code"
		>
			{roomId}
		</button>
		<div class="mx-0.5 h-3.5 w-px bg-(--surface-2)"></div>
		<button
			onclick={copyRoomCode}
			class="rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors focus:outline-none {copiedCode
				? 'bg-emerald-500/20 text-emerald-300'
				: 'bg-(--surface-2) text-(--ink-2) hover:text-(--ink-1)'}"
			title="Copy room code only ({roomId})"
		>
			{copiedCode ? 'Code Copied!' : 'Copy Code'}
		</button>
		<button
			onclick={copyRoomLink}
			class="rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors focus:outline-none {copiedLink
				? 'bg-emerald-500/20 text-emerald-300'
				: 'bg-(--surface-2) text-(--ink-2) hover:text-(--ink-1)'}"
			title="Copy full invite link"
		>
			{copiedLink ? 'Link Copied!' : 'Copy Link'}
		</button>
	</div>

	<!-- Connection Status Indicator -->
	<div
		class="flex items-center gap-1.5 rounded-lg border border-(--surface-2) bg-(--surface-1) px-2.5 py-1.5 shadow-lg backdrop-blur-md"
	>
		{#if status === 'connected'}
			<span class="h-2 w-2 rounded-full bg-emerald-500" title="Connected"></span>
			<span class="text-xs font-medium text-emerald-400">Live</span>
		{:else if status === 'connecting' || status === 'reconnecting'}
			<span class="h-2 w-2 animate-pulse rounded-full bg-amber-500" title="Connecting..."></span>
			<span class="text-xs font-medium text-amber-400">Reconnecting...</span>
		{:else}
			<span class="h-2 w-2 rounded-full bg-rose-500" title="Disconnected"></span>
			<span class="text-xs font-medium text-rose-400">Offline</span>
		{/if}
	</div>

	<!-- Peers & User Pill -->
	<div
		class="flex items-center gap-1.5 rounded-lg border border-(--surface-2) bg-(--surface-1) px-2 py-1.5 shadow-lg backdrop-blur-md"
	>
		<!-- Connected Peer Avatars -->
		<div class="flex items-center -space-x-1.5 overflow-hidden">
			{#each peers as peer (peer.userId)}
				<div
					class="flex h-6 w-6 cursor-help items-center justify-center rounded-full border-2 border-(--surface-1) text-[10px] font-bold text-black shadow-sm"
					style="background-color: {peer.color};"
					title={peer.name}
				>
					{getInitials(peer.name)}
				</div>
			{/each}
		</div>

		<!-- Local Current User Pill -->
		<div class="flex items-center gap-1.5 pl-1">
			<div
				class="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-[10px] font-bold text-black"
				style="background-color: {currentUser.color};"
			>
				{getInitials(currentUser.name)}
			</div>

			{#if isEditingName}
				<input
					type="text"
					bind:value={nameInput}
					onblur={saveName}
					onkeydown={handleKeyDown}
					class="w-24 rounded border border-[#6366f1] bg-(--surface-2) px-1.5 py-0.5 text-xs text-(--ink-1) focus:outline-none"
				/>
			{:else}
				<button
					onclick={() => (isEditingName = true)}
					class="max-w-[100px] truncate text-xs text-(--ink-1) transition-colors hover:text-[#6366f1] focus:outline-none"
					title="Click to edit your display name"
				>
					{currentUser.name}
				</button>
			{/if}
		</div>
	</div>
</div>
