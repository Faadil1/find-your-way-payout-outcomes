# Build Plan — Payout Outcomes

Status: **AUTHORIZED AFTER TECHNICAL REALITY PROOF**

## Phase 0 — Proven
- Strict Receive exact amount.
- `op_no_trust`.
- Claimable create/claim.
- Time-bound treasury reclaim.
- Runtime/commit evidence binding.

## Phase 1 — Product vertical slice
Build the smallest operator product that exercises the proven mechanisms through one shared product core.

Deliver:
- React/Vite shell.
- Outcome/state model.
- capability preflight.
- settlement policy engine.
- Stellar execution adapter.
- operator batch surface.
- recipient claim action.
- evidence timeline / receipt.

Acceptance:
- judge can run ready + no-trust + claim flow from the product UI;
- no manual CLI step required for primary hero path;
- all displayed outcome states come from real ledger/result evidence.

## Phase 2 — Negative / boundary / recovery depth
Add:
- no-route/sendMax boundary;
- claim timeout and real reclaim;
- RECONCILING anti-duplicate guard;
- unsupported state → NEEDS_HUMAN;
- reset/new-demo path.

## Phase 3 — Judge self-serve + design
Add:
- one-click deterministic demo setup;
- progressive explanation;
- strong first-15-second problem framing;
- proof visible by 30–45 seconds;
- responsive/mobile-safe UI;
- keyboard/reduced-motion pass;
- public receipt/evidence links where practical.

## Phase 4 — Optional depth gates
Evaluate, do not auto-add:
- C-address/SAC support;
- CSV batch input;
- one mainnet micro-proof.

Each must pass marginal-value vs risk/deadline review.

## Phase 5 — Audit and terminal assurance
- local tests / typecheck / build.
- engineering quality pass.
- Product Depth Gap Review.
- Evidence Graph reconciliation.
- deployment binding.
- deterministic clean run.
- Judge Performance Assurance.
- Project Finisher.
- pitch video ≤ 3 minutes.
- Q&A pack.
- submission integrity.

## Branching

1. Merge `spike/technical-reality` after receipt + PRD review.
2. Create `build/core-outcome-loop`.
3. No direct consequential code on `main`.
4. Focused change → CI → runtime/evidence → state update → PR.

## Cut order if deadline pressure rises

Cut first:
1. C-address/SAC.
2. CSV.
3. mainnet micro-proof.
4. secondary animations/polish.

Never cut:
- live core loop;
- negative event;
- claim/reclaim recovery;
- truth boundary;
- evidence receipt;
- operator surface;
- submission integrity.
