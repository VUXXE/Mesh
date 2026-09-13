<script lang="ts">
	import { goto } from '$app/navigation';

	let joinRoomId = $state('');
	let errorMessage = $state('');

	function generateRoomId(): string {
		const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
		let result = '';
		for (let i = 0; i < 6; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return `room-${result}`;
	}

	function createRoom() {
		const newId = generateRoomId();
		goto(`/room/${newId}`);
	}

	function handleJoin(e: Event) {
		e.preventDefault();
		const trimmed = joinRoomId.trim();
		if (!trimmed) {
			errorMessage = 'Please enter a room code';
			return;
		}

		if (!/^[a-zA-Z0-9_-]{3,64}$/.test(trimmed)) {
			errorMessage = 'Room ID must be 3-64 alphanumeric characters, underscores, or hyphens';
			return;
		}

		goto(`/room/${trimmed}`);
	}
</script>

<svelte:head>
	<title>CanvasSync: Serverless Real-Time Vector Whiteboard</title>
</svelte:head>

<main
	class="flex min-h-screen w-full flex-col items-center justify-center bg-[#121214] p-6 text-[#f4f4f5]"
>
	<div class="w-full max-w-md rounded-2xl border border-[#27272a] bg-[#18181b] p-8 shadow-2xl">
		<!-- Brand & Logo -->
		<div class="mb-6 flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366f1] shadow-md">
				<svg
					class="h-5 w-5 text-white"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path d="M12 19l7-7 3 3-7 7-3-3z" />
					<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
					<path d="M2 2l7.586 7.586" />
				</svg>
			</div>
			<div>
				<h1 class="text-xl font-bold tracking-tight text-[#f4f4f5]">CanvasSync</h1>
				<p class="text-xs text-[#a1a1aa]">Real-time collaborative vector whiteboard</p>
			</div>
		</div>

		<!-- Action: Create Room -->
		<div class="space-y-4">
			<button
				onclick={createRoom}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-4 py-3 font-medium text-white shadow-sm transition-colors hover:bg-[#4f46e5] focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2 focus:ring-offset-[#18181b] focus:outline-none"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				<span>Create New Whiteboard</span>
			</button>

			<div class="my-4 flex items-center gap-3">
				<div class="h-px flex-1 bg-[#27272a]"></div>
				<span class="font-mono text-xs text-[#71717a] uppercase">or join existing</span>
				<div class="h-px flex-1 bg-[#27272a]"></div>
			</div>

			<!-- Action: Join Existing Room -->
			<form onsubmit={handleJoin} class="space-y-2">
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={joinRoomId}
						placeholder="e.g. room-abc123"
						class="flex-1 rounded-xl border border-[#27272a] bg-[#121214] px-3.5 py-2.5 font-mono text-sm text-[#f4f4f5] placeholder-[#71717a] transition-all focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] focus:outline-none"
					/>
					<button
						type="submit"
						class="rounded-xl bg-[#27272a] px-4 py-2.5 text-sm font-medium text-[#f4f4f5] transition-colors hover:bg-[#3f3f46] focus:outline-none"
					>
						Join
					</button>
				</div>

				{#if errorMessage}
					<p class="mt-1 text-xs text-rose-400">{errorMessage}</p>
				{/if}
			</form>
		</div>

		<!-- Specifications summary footer -->
		<div
			class="mt-8 flex items-center justify-between border-t border-[#27272a] pt-6 text-[11px] text-[#71717a]"
		>
			<span>Cloudflare Workers + SQLite</span>
			<span>Sub-16ms feedback</span>
		</div>
	</div>
</main>
