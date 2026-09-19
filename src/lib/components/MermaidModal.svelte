<script lang="ts">
	import { parseMermaidToShapes } from '$lib/client/mermaid-parser';
	import type { ShapeRecord } from '$lib/types';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onInsertShapes: (shapes: ShapeRecord[]) => void;
		viewportCenter: { x: number; y: number };
		startZIndex: number;
	}

	let { isOpen, onClose, onInsertShapes, viewportCenter, startZIndex }: Props = $props();

	const SAMPLES: Record<string, string> = {
		architecture: `flowchart LR
  Client[Web Client] --> API_Gateway[API Gateway]
  API_Gateway --> Auth[Auth Service]
  API_Gateway --> Worker[Cloudflare Worker]
  Worker --> DB[(SQLite Database)]`,
		flowchart: `flowchart TD
  Start([Start Request]) --> AuthCheck{Is Token Valid?}
  AuthCheck -->|Yes| Process[Process Request]
  AuthCheck -->|No| Reject[Return 401 Unauthorized]
  Process --> Finish([Success Response])`,
		pipeline: `flowchart LR
  Source[(Raw Data)] --> Ingest[Ingest Worker]
  Ingest --> Filter{Validate?}
  Filter -->|Pass| Transform[Transform & Enrich]
  Filter -->|Fail| DLQ[(Dead Letter Queue)]
  Transform --> Target[(Analytics Store)]`
	};

	let code = $state(SAMPLES.architecture);
	let errorMessage = $state<string | null>(null);

	function setTemplate(key: string) {
		if (SAMPLES[key]) {
			code = SAMPLES[key];
			errorMessage = null;
		}
	}

	function handleInsert() {
		errorMessage = null;
		const result = parseMermaidToShapes(code, viewportCenter, startZIndex);
		if (result.error || result.shapes.length === 0) {
			errorMessage = result.error || 'Failed to parse diagram. Please check your syntax.';
			return;
		}
		onInsertShapes(result.shapes);
		onClose();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		} else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleInsert();
		}
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onkeydown={handleKeyDown}
	>
		<!-- Modal Box -->
		<div
			class="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-(--surface-2) bg-(--surface-1) shadow-2xl"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-(--surface-2) px-5 py-3.5">
				<div class="flex items-center gap-2">
					<div
						class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#6366f1]/20 text-[#818cf8]"
					>
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="3" y="3" width="7" height="7" rx="1" />
							<rect x="14" y="3" width="7" height="7" rx="1" />
							<rect x="14" y="14" width="7" height="7" rx="1" />
							<rect x="3" y="14" width="7" height="7" rx="1" />
							<path d="M10 6.5h4M17.5 10v4M14 17.5h-4M6.5 14v-4" />
						</svg>
					</div>
					<div>
						<h2 class="text-sm font-medium text-(--ink-1)">Text to Diagram (Mermaid)</h2>
						<p class="text-xs text-(--ink-2)">
							Generate architecture and flowcharts instantly from text
						</p>
					</div>
				</div>

				<button
					onclick={onClose}
					class="rounded-lg p-1.5 text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1)"
					title="Close (Esc)"
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Template Pills -->
			<div class="flex items-center gap-2 px-5 pt-3 text-xs text-(--ink-2)">
				<span>Templates:</span>
				<button
					type="button"
					onclick={() => setTemplate('architecture')}
					class="rounded-md bg-(--surface-2) px-2.5 py-1 text-(--ink-1) transition-colors hover:bg-[#6366f1]/20 hover:text-[#818cf8]"
				>
					Architecture
				</button>
				<button
					type="button"
					onclick={() => setTemplate('flowchart')}
					class="rounded-md bg-(--surface-2) px-2.5 py-1 text-(--ink-1) transition-colors hover:bg-[#6366f1]/20 hover:text-[#818cf8]"
				>
					Decision Tree
				</button>
				<button
					type="button"
					onclick={() => setTemplate('pipeline')}
					class="rounded-md bg-(--surface-2) px-2.5 py-1 text-(--ink-1) transition-colors hover:bg-[#6366f1]/20 hover:text-[#818cf8]"
				>
					Data Pipeline
				</button>
			</div>

			<!-- Editor -->
			<div class="px-5 py-3">
				<textarea
					bind:value={code}
					rows="10"
					placeholder="flowchart LR..."
					class="w-full resize-none rounded-lg border border-(--surface-2) bg-(--surface-0) p-3 font-mono text-xs leading-relaxed text-(--ink-1) placeholder-(--ink-2) focus:border-[#6366f1] focus:outline-none"
				></textarea>

				{#if errorMessage}
					<div
						class="mt-2 rounded-md border border-red-800/50 bg-red-950/40 p-2 text-xs text-red-400"
					>
						{errorMessage}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-between border-t border-(--surface-2) bg-(--surface-1) px-5 py-3"
			>
				<div class="text-[11px] text-(--ink-2)">
					Tip: Press <kbd class="rounded bg-(--surface-2) px-1.5 py-0.5 text-(--ink-1)">Ctrl</kbd> +
					<kbd class="rounded bg-(--surface-2) px-1.5 py-0.5 text-(--ink-1)">Enter</kbd> to insert
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={onClose}
						class="rounded-lg px-3 py-1.5 text-xs text-(--ink-2) transition-colors hover:bg-(--surface-2) hover:text-(--ink-1)"
					>
						Cancel
					</button>
					<button
						onclick={handleInsert}
						class="flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#4f46e5]"
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M12 5v14M5 12h14" />
						</svg>
						Insert to Canvas
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
