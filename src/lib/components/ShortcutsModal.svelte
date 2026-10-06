<script lang="ts">
	import { SHORTCUT_GROUPS, type ShortcutGroup } from '$lib/client/shortcuts';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();

	let searchQuery = $state('');

	let filteredGroups = $derived(
		searchQuery.trim() === ''
			? SHORTCUT_GROUPS
			: SHORTCUT_GROUPS.map((group) => {
					const q = searchQuery.toLowerCase().trim();
					const matchingItems = group.items.filter(
						(item) =>
							item.label.toLowerCase().includes(q) ||
							(item.description && item.description.toLowerCase().includes(q)) ||
							item.keys.some((k) => k.toLowerCase().includes(q))
					);
					return {
						...group,
						items: matchingItems
					};
				}).filter((group) => group.items.length > 0)
	);

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			onClose();
		}
	}
</script>

<svelte:window onkeydown={isOpen ? handleKeydown : undefined} />

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		aria-labelledby="shortcuts-modal-title"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		}}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-(--surface-2) bg-(--surface-1) text-(--ink-1) shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-(--surface-2) px-6 py-4">
				<div class="flex items-center gap-2">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-(--surface-2) text-(--ink-1)"
					>
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="2" y="4" width="20" height="16" rx="2" />
							<path
								d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"
							/>
						</svg>
					</div>
					<div>
						<h2 id="shortcuts-modal-title" class="text-base font-semibold text-(--ink-1)">
							Keyboard Shortcuts
						</h2>
						<p class="text-xs text-(--ink-2)">Speed up your whiteboard workflow</p>
					</div>
				</div>

				<button
					onclick={onClose}
					class="flex h-8 w-8 items-center justify-center rounded-lg text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1) focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]"
					aria-label="Close shortcuts modal"
				>
					<svg
						class="h-4 w-4"
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

			<!-- Search Bar -->
			<div class="border-b border-(--surface-2) px-6 py-3">
				<div class="relative">
					<svg
						class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--ink-2)"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
					<input
						type="search"
						bind:value={searchQuery}
						placeholder="Search shortcuts..."
						class="w-full rounded-xl border border-(--surface-2) bg-(--surface-2)/40 py-2 pr-4 pl-9 text-xs text-(--ink-1) placeholder-(--ink-2) transition-colors focus:border-[#6366f1] focus:bg-(--surface-2)/70 focus:ring-1 focus:ring-[#6366f1] focus:outline-none"
					/>
				</div>
			</div>

			<!-- Body / Content -->
			<div class="no-scrollbar flex-1 overflow-y-auto px-6 py-4">
				{#if filteredGroups.length === 0}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<p class="text-sm text-(--ink-2)">No shortcuts found for "{searchQuery}"</p>
					</div>
				{:else}
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						{#each filteredGroups as group (group.name)}
							<div class="flex flex-col gap-2">
								<h3 class="text-xs font-semibold tracking-wider text-(--ink-2) uppercase">
									{group.name}
								</h3>
								<div
									class="flex flex-col gap-1.5 rounded-xl border border-(--surface-2) bg-(--surface-2)/20 p-2.5"
								>
									{#each group.items as item (item.label)}
										<div class="flex items-center justify-between gap-2 py-0.5">
											<span class="text-xs text-(--ink-1)">{item.label}</span>
											<div class="flex items-center gap-1">
												{#each item.keys as key}
													<kbd
														class="rounded border border-(--surface-3) bg-(--surface-2) px-2 py-0.5 font-mono text-[11px] text-(--ink-1) shadow-xs"
													>
														{key}
													</kbd>
												{/each}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-between border-t border-(--surface-2) px-6 py-3 text-[11px] text-(--ink-2)"
			>
				<span
					>Tip: Press <kbd
						class="rounded border border-(--surface-2) bg-(--surface-2) px-1 py-0.5 font-mono text-[10px]"
						>?</kbd
					>
					or
					<kbd
						class="rounded border border-(--surface-2) bg-(--surface-2) px-1 py-0.5 font-mono text-[10px]"
						>Esc</kbd
					> anytime</span
				>
				<button
					onclick={onClose}
					class="rounded-lg px-2.5 py-1 text-xs font-medium text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1)"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
