# Migration to e2e

Source: custom test scripts, `scripts/test-*.ts` (guide: https://e2e.tester.army/docs/migrate/playwright.md, engine: https://e2e.tester.army/docs/web.md)
e2e: `e2e.config.ts`, tests `tests/**/*.e2e.ts`
Start dependencies: `bun run build`
Run old: `PORT=4173 bun run scripts/test-e2e.ts`
Run new: `bun run test:e2e`
Harness: done, smoke `tests/example.e2e.ts` on web
Defect check: off

| Source                               | e2e                                   | Status | Assertions (source → e2e) | Passing | Defect check | Notes                                                                                     |
| ------------------------------------ | ------------------------------------- | ------ | ------------------------- | ------- | ------------ | ----------------------------------------------------------------------------------------- |
| scripts/test-e2e.ts                  | tests/e2e-verification.e2e.ts         | ported | 5 → 6                     | web 3/3 | off          | Old script raw fetch fails because app has ssr=false; e2e renders full browser and passes |
| scripts/test-handshake.ts            | tests/handshake.e2e.ts                | ported | 3 → 5                     | web 3/3 | off          | Live edge plumbing & WebSocket handshake                                                  |
| scripts/test-sync-and-presence.ts    | tests/sync-presence.e2e.ts            | ported | 4 → 9                     | web 3/3 | off          | Live real-time sync, presence, LWW                                                        |
| scripts/test-room-password.ts        | tests/room-password.e2e.ts            | ported | 5 → 8                     | web 3/3 | off          | Live password authentication & security                                                   |
| scripts/test-sticky-note.ts          | tests/geometry-and-tools.e2e.ts       | ported | 3 → 6                     | web 3/3 | off          | Live sticky note editing, bounds & hit-testing                                            |
| scripts/test-arrow-line.ts           | tests/geometry-and-tools.e2e.ts       | ported | 3 → 5                     | web 3/3 | off          | Line & arrow geometry, arrowhead flag & hit-testing                                       |
| scripts/test-font-picker.ts          | tests/editing-and-interactions.e2e.ts | ported | 3 → 14                    | web 3/3 | off          | Font families, sizes, canvas engine sync & bounds                                         |
| scripts/test-touch-pinch.ts          | tests/geometry-and-tools.e2e.ts       | ported | 3 → 8                     | web 3/3 | off          | Multi-touch pinch zoom & pan transformation math                                          |
| scripts/test-canvas-modules.ts       | tests/security-and-worker.e2e.ts      | ported | 12 → 17                   | web 3/3 | off          | Text wrapping, arrow/cursor rendering & export/import                                     |
| scripts/test-security-fixes.ts       | tests/security-and-worker.e2e.ts      | ported | 6 → 8                     | web 3/3 | off          | Timestamp clamping, PBKDF2 hashing & unauthed filtering                                   |
| scripts/test-room-link-parser.ts     | tests/security-and-worker.e2e.ts      | ported | 4 → 8                     | web 3/3 | off          | Room code & URL extraction (localhost & prod)                                             |
| scripts/test-history.ts              | tests/editing-and-interactions.e2e.ts | ported | 6 → 18                    | web 3/3 | off          | Undo/redo history: create, modify, delete, batch_create                                   |
| scripts/test-export-import.ts        | tests/security-and-worker.e2e.ts      | ported | 5 → 7                     | web 3/3 | off          | Export structure & fresh unique IDs with monotonic zIndex                                 |
| scripts/test-presence-quota.ts       | tests/security-and-worker.e2e.ts      | ported | 4 → 7                     | web 3/3 | off          | Solo suppression, peer arrival, deadband & 15Hz throttling                                |
| scripts/test-worker-efficiency.ts    | tests/security-and-worker.e2e.ts      | ported | 4 → 13                    | web 3/3 | off          | SQLite RETURNING *, batch delete, float rounding & cache                                  |
| scripts/test-cursor-interpolation.ts | tests/geometry-and-tools.e2e.ts       | ported | 4 → 5                     | web 3/3 | off          | Cursor interpolation decay, 1000px snap & alpha decay                                     |
| scripts/test-marquee-selection.ts    | tests/geometry-and-tools.e2e.ts       | ported | 5 → 8                     | web 3/3 | off          | Marquee enclosed, intersecting, diagonal & hollow shapes                                  |
| scripts/test-tier2-diagramming.ts    | tests/diagram-and-styling.e2e.ts      | ported | 5 → 24                    | web 3/3 | off          | Diamond hit-test, cardinal anchors, smart connectors & undo/redo                          |
| scripts/test-native-paste.ts         | tests/editing-and-interactions.e2e.ts | ported | 4 → 7                     | web 3/3 | off          | In-memory clipboard priority & plain-text pasting                                         |
| scripts/test-tier1-editing.ts        | tests/editing-and-interactions.e2e.ts | ported | 5 → 31                    | web 3/3 | off          | Clone, selectAll, copy/paste, duplicate, cut, z-index                                     |
| scripts/test-diagram-mode.ts         | tests/diagram-and-styling.e2e.ts      | ported | 4 → 16                    | web 3/3 | off          | Orthogonal elbow paths, snap guides, quick-add & Mermaid                                  |
| scripts/test-excalidraw-styling.ts   | tests/diagram-and-styling.e2e.ts      | ported | 4 → 17                    | web 3/3 | off          | SVG hachure patterns, dashed/dotted strokes & roundness                                   |
| scripts/test-grid-indicators.ts      | tests/diagram-and-styling.e2e.ts      | ported | 3 → 6                     | web 3/3 | off          | PresenceBar grid labels, snap badge & real-time HUD                                       |
| scripts/test-grid-mode.ts            | tests/diagram-and-styling.e2e.ts      | ported | 3 → 9                     | web 3/3 | off          | Light/dark mode grid dots contrast, lines mode & swatches                                 |
| scripts/test-profile-editing.ts      | tests/diagram-and-styling.e2e.ts      | ported | 4 → 12                    | web 3/3 | off          | 8-color presence palette, avatar preview & user profile                                   |
| scripts/test-keyboard-shortcuts.ts   | tests/editing-and-interactions.e2e.ts | ported | 6 → 21                    | web 3/3 | off          | Shortcuts catalog, zoom/pan clamping, nudge & modal UI                                    |

## Shared helpers

| Source | e2e | Used by |
| ------ | --- | ------- |
| none   |     |         |

## Gaps

- none

## Next

- Complete: All 25 legacy test scripts ported to `tests/**/*.e2e.ts` with 3/3 pass rate on web target.
