# Mission Control (rebuild)

New front end for waxmissioncontrol.io: Vite + React 18 + TypeScript, WharfKit (WAX Cloud Wallet, Wombat and Anchor; Anchor cannot mine), TanStack Query, zustand.

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # dist/ (includes 404.html for clean-URL hosting)
npm test           # proof-of-work unit tests
npm run images     # refresh local IPFS avatars/tutorial images and tool card images
```

## Structure

| Folder           | What lives there                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `src/chain`      | Contract names and node lists, the endpoint pool (probe, rank, rotate), RPC and AtomicAssets clients |
| `src/data`       | Table readers, React Query hooks, favorites and news loaders                                         |
| `src/mining`     | Proof of work (worker), mine/setland actions, cooldown and yield estimates                           |
| `src/wallet`     | WharfKit session                                                                                     |
| `src/components` | Design system pieces and the app shell (header, section nav, drawer)                                 |
| `src/pages`      | Landing, Menu dashboard, Weekly Quests, Rewards, Daily Claim, Mining                                 |

## Notes

- Reads rotate across the fastest healthy WAX nodes (3 calls per node per 3 s); per-user reads that come back empty are re-checked on a second node.
- IPFS images are served from `public/ipfs`; anything newer falls back to public gateways.
- Development only: add `?as=<account>` to a URL to view that account's pages read-only without a wallet. This is compiled out of production builds.
- The original site shipped `cpu.mc` private keys and an API token in its public bundle. None of that is carried over; if cosigned CPU is wanted again it needs a server-side signer.
