# Mission Control (rebuild)

New front end for waxmissioncontrol.io: Vite + React 18 + TypeScript, TanStack Query, zustand, and WharfKit with WAX Cloud Wallet, Wombat and Anchor. Anchor can sign in but never mine.

```bash
npm install
npm run dev           # http://localhost:5180
npm run build         # type-check (including tests) and build to dist/, with 404.html for clean URLs
npm run preview       # serve dist/ on http://localhost:5181
npm test              # unit tests (vitest)
npm run lint          # ESLint, with type-aware promise rules
npm run format        # Prettier; format:check only reports
npm run images        # refresh local images: IPFS avatars, tool, adventure and card art, page banners
```

Every push to `main` runs lint, the format check and the tests, then builds with `BASE_PATH=/mc-test/` and deploys to GitHub Pages.

## Structure

| Folder              | What lives there                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/chain`         | Contract names and node lists, the endpoint pool (probe, rank, rotate), RPC, AtomicAssets and history-node clients |
| `src/chain/actions` | Every contract action the site signs, one file per area (mining, rewards, builder, …)                              |
| `src/data`          | Table readers, React Query hooks per feature, query keys (`keys.ts`) and row types (`types/`)                      |
| `src/mining`        | Proof of work (in a worker), the mine and Tool Loaning flows, cooldown and yield estimates                         |
| `src/wallet`        | WharfKit session (loaded on demand), the Anchor mining guard and `useTransaction`                                  |
| `src/state`         | zustand stores: session and mining mode, node status                                                               |
| `src/components`    | Shared UI (Button, Modal, LoadError, Ticking, …) and the app shell in `layout/`                                    |
| `src/icons`         | Game icons, one per file, and UI glyphs in `ui.tsx`                                                                |
| `src/pages`         | One folder or file per screen                                                                                      |

## Conventions

- **Reads.** `getRows` returns every row, following `next_key`, unless given a `limit`. Per-user reads that come back empty are checked again on a second node. Nodes rotate, 3 calls per node per 3 s.
- **Query keys** come from the factories in `data/keys.ts`; refreshes invalidate by those prefixes.
- **Failed reads** show the `LoadError` banner instead of zeros. A query whose page shows its own error, or whose failure loses nothing, sets `meta: { silentError: true }`.
- **Signing** goes through `useTransaction().run(build, success, refresh, key)`: toast, then a re-read after the chain catches up. Build actions with `chain/actions`.
- **Clocks.** Pages decide what is ready with `useClockFor(times)`, which re-renders only when one of those moments passes. Countdown text that changes every second uses `<Ticking>`.
- **UI.** Dialogs use `Modal`, menus and popovers close with `useDismiss`, plate buttons come from `.plates` / `.btn--plate`, text fields take `.input`.
- **Public files** go through `publicUrl()`, so the site also works under `/mc-test/`.

## Notes

- Development only: add `?as=<account>` to a URL to view that account's screens read-only without a wallet. It is compiled out of production builds.
- Production builds carry a Content Security Policy (see `vite.config.ts`). A new external host has to be added there, or its requests are blocked.
- IPFS avatars are served from `public/ipfs`; anything newer falls back to public gateways.
- The original site shipped `cpu.mc` private keys and an API token in its public bundle. None of that is carried over; if cosigned CPU is wanted again, it needs a server-side signer.
