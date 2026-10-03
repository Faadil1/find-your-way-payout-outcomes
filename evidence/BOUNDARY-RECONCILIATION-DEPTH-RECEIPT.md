# Boundary & Reconciliation Depth Receipt — 2026-10-03

Status: **NEGATIVE_BOUNDARY_RECONCILIATION_DEPTH_PROVEN**

## Runtime binding

- Repository: `Faadil1/find-your-way-payout-outcomes`
- Branch: `build/core-outcome-loop`
- Commit: `f4f83969f96eb114242ab482c32d5ddc4a175119`
- Workflow: `Live UI Proof`
- Run: `37089058200`
- Artifact: `live-ui-proof`
- Artifact ID: `11262205391`
- Artifact digest: `sha256:11a1dfeede6f55a139a53304cd5e157cf66f6400c63edea28331eb5f7df14ef4`
- Browser: Chromium
- Ledger: Stellar Testnet
- Receipt generated: `2026-10-03T02:16:52.713Z`

## Boundary proof — sender cost guard

The product requested an exact 5 POAUSD destination outcome while capping sender cost at 1 XLM.

Observed result:

- state: **PROVEN**
- Stellar operation code: `op_over_source_max`
- transaction hash: `95f2883be1d5814b9ee2d838d62fd28fa34014a9f5d2f63c90df1c375581ecb9`
- product outcome: `FAILED_NO_FUNDS_MOVED`

The product did not degrade the recipient amount and did not report success.

## Reconciliation proof — no blind duplicate

The browser product broadcast one real Testnet asset payment and intentionally discarded the returned success response.

Observed sequence:

1. broadcast transaction `446b8895378ed1af7b97e84f9f7b4b5a11ee1296624b8759a120dc43f6537dd6`;
2. product state entered `RECONCILING`;
3. retry control was blocked;
4. product queried Horizon using the original transaction hash;
5. recipient balance moved from `4990.0000000` to `4991.0000000`;
6. product resolved to `USABLE`;
7. no second payout was broadcast.

This is an **INDUCED_FAILURE** at the client-response layer plus **LIVE_TESTNET** reconciliation evidence.

## Other core outcomes in the same run

- exact Strict Receive → `USABLE`
- missing trustline → real `op_no_trust`
- changed guarantee → Claimable Balance
- recipient claim → `USABLE`
- timeout + treasury reclaim → `RETURNED`

## Promotion consequence

The material post-vertical-slice gaps for boundary behavior and anti-duplicate reconciliation are closed.

Remaining material gaps before BUILD_CANDIDATE_READY:

- stable public judge runtime;
- deployment identity / commit binding;
- clean hosted run;
- judge self-serve evidence from the hosted runtime;
- engineering-quality assurance;
- story/demo/Q&A;
- Project Finisher terminal assurance;
- final submission integrity.
