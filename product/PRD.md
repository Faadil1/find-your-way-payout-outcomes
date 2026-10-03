# Payout Outcomes — Living PRD v0.1

Status: **BUILD SCOPE LOCKED / LIVING**  
Competition: Find Your Way — Stellar  
Working product name: **Payout Outcomes** (not Naming Lock)  
Canonical mechanism: **Outcome Assurance for heterogeneous Stellar payouts**

## 1. Product statement

Payout Outcomes is an operator-facing Stellar payout reliability product that ensures every payout ends in a truthful, verifiable state:

- **USABLE** — value is in the recipient's spendable balance.
- **CLAIMABLE** — value is waiting safely under explicit claim/reclaim conditions.
- **RETURNED** — value has actually returned to the payer.
- **NEEDS_HUMAN** — no safe automatic action exists.
- **FAILED_NO_FUNDS_MOVED** — execution failed and no value settled.
- **RECONCILING** — outcome is not yet certain; duplicate execution is forbidden.

Memory sentence:

> **Paid means usable, waiting safely, returned, or explicitly unresolved — never merely sent.**

## 2. User and JTBD

### Primary user
A payout operator at a small organization, marketplace, bounty/grants program, payroll operation, or aid program paying roughly 10–500 recipients in Stellar assets.

### JTBD
> When I pay a list of people, I need to know what each recipient can actually receive, select a settlement method that matches that capability, and end every payout in a verifiable state without blind retries or ambiguous "sent" records.

## 3. Problem and negative event

The build is not based on generic "cross-border payments are inefficient."

The grounded negative event is:

> A recipient cannot hold the target asset. A naive payment fails with `op_no_trust`; retrying the same operation does not repair recipient readiness.

The technical spike observed this live on Stellar Testnet and proved a different settlement guarantee: Claimable Balance → recipient becomes ready → claim, or time-bound treasury reclaim.

## 4. Differentiator

Not novel:
- path finding
- generic routing
- retries
- claimable balances
- bulk payouts
- smart wallets
- result codes

Proposed differentiator:

> **One outcome contract across heterogeneous recipient capabilities, where preflight state changes the Stellar settlement guarantee and reconciliation never upgrades an outcome above what live evidence proves.**

The product must remain clearly distinct from:
- a generic payment router;
- SDP reimplementation;
- an off-ramp aggregator;
- "AI for payments";
- a claimable-balance wrapper.

## 5. Goals

### MUST
- Provide a self-serve operator surface.
- Run recipient capability preflight against live Stellar Testnet.
- Execute at least one real exact-amount Strict Receive flow.
- Detect and display a real no-trust failure.
- Use Claimable Balance as a different settlement guarantee for an unready recipient.
- Support live claim and live treasury reclaim.
- Maintain outcome states with evidence pointers.
- Provide a per-payout event timeline and receipt.
- Clearly label induced failure and any non-live behavior.
- Prevent blind retry when state is uncertain or unchanged.

### SHOULD
- Support batch input for 2–5 demo recipients.
- Preflight before any transaction when possible.
- Offer a "naive mode" comparison showing why the outcome layer matters.
- Let the judge run the full core loop without wallet installation.
- Keep time to first visible value under 60 seconds after demo environment is ready.

### MAY
- Add C-address/SAC transfer after a bounded technical spike.
- Add CSV upload after hero path works.
- Add public receipt URLs after local receipt rendering works.
- Add one mainnet micro-proof only if it does not endanger deterministic demo reliability.

### MUST NOT
- Claim fiat cash-out or local cash receipt.
- Depend on MoneyGram, production anchors, SEP-31, x402, MPP, generic AI routing, or Proof-to-Pay.
- Add a custom Soroban contract merely for sponsor theater.
- Mark a payout successful solely because a submission was accepted.
- Retry an ambiguous payment before reconciliation.
- Represent self-seeded liquidity as organic liquidity.

## 6. Core invariants

1. **Outcome truth > transaction optimism.**
2. **No duplicate execution under uncertainty.**
3. **Settlement policy is deterministic and inspectable.**
4. **Recipient capability can change the operation type.**
5. **Every live claim has a receipt.**
6. **Induced, simulated, and not-implemented behavior is visibly labeled.**
7. **Vertical slice is the entry point, not Definition of Done.**

## 7. Primary flow

1. Operator creates a payout intent: recipient, target asset, exact amount, sender budget, claim timeout policy.
2. Capability Preflight inspects:
   - account existence;
   - target-asset trustline;
   - current balances/constraints relevant to the selected operation;
   - address type where supported.
3. Settlement Policy chooses one supported guarantee:
   - ready classic account → direct payment or Strict Receive;
   - classic account without trustline → Claimable Balance with recipient-before-T and payer-after-T predicates;
   - unsupported/unknown condition → NEEDS_HUMAN.
4. Executor submits the real Stellar operation.
5. Reconciler reads the ledger result and updates the outcome.
6. Recipient may become ready and claim.
7. Payer may reclaim after timeout.
8. Receipt binds intent → decision → runtime → result → transaction hashes.

## 8. Hero demo

Target length: 60–100 seconds for the core proof; full pitch ≤ 3 minutes.

- Start with one naive payment to an unready recipient → real `op_no_trust`.
- Run the same payout through Payout Outcomes:
  - Ready recipient → exact live delivery.
  - Unready recipient → Claimable Balance rather than blind retry.
- Recipient adds trustline and claims → `CLAIMABLE → USABLE`.
- Second unclaimed balance reaches cutoff; operator reclaims → `CLAIMABLE → RETURNED`.
- Final batch receipt shows every outcome and its transaction evidence.

Optional only after core depth: induced liquidity failure and bounded alternate outcome.

## 9. Product surfaces

### Operator Console
- batch/intent creation;
- recipient capability labels;
- chosen settlement guarantee;
- execution status;
- outcome state;
- next safe action;
- evidence timeline.

### Recipient Claim Surface
- amount waiting;
- deadline;
- readiness action;
- claim action;
- resulting live state.

### Receipt Surface
- original intent;
- policy decision;
- truth-boundary label;
- transaction/result evidence;
- final outcome.

All surfaces should share one canonical outcome/policy model.

## 10. Architecture constraints

- TypeScript-first.
- Stellar SDK is the only load-bearing chain client.
- Testnet-only for the hackathon core unless a separate mainnet proof is explicitly authorized.
- No production user funds.
- No secrets committed to Git.
- Client-visible keys, if any, are ephemeral Testnet-only and must be clearly marked.
- Ledger is authoritative for transaction state.
- UI state must never override ledger evidence.

Detailed architecture: `ARCHITECTURE.md`.

## 11. NFRs

- Deterministic recovery decisions for supported classes.
- Idempotent user actions where double-send risk exists.
- Explicit loading, pending, failed, and unknown states.
- Accessible keyboard navigation and reduced-motion behavior for core flow.
- Mobile-safe layout for judge viewing.
- Fast failure: unsupported conditions return NEEDS_HUMAN rather than invented recovery.
- Reproducible testnet demo and evidence export.

## 12. Product depth after first vertical slice

The build must continue after first success through:
- success scenario;
- negative no-trust scenario;
- recovery claim;
- recovery return;
- boundary sendMax/no-path behavior;
- reconciliation and anti-duplicate behavior;
- operator surface;
- recipient surface;
- evidence surface;
- setup/reproducibility;
- clean-run from a fresh browser/session;
- post-slice depth gap review.

## 13. Success measures

For hackathon evidence, success is demonstrated behavior, not adoption claims:

- 100% of demo payouts terminate in one allowed outcome state.
- 0 unsupported states silently reported as success.
- 0 blind duplicate sends in representative test scenarios.
- Exact-amount Strict Receive proof remains reproducible.
- Claim and reclaim paths remain reproducible.
- Judge can reach first meaningful product action within 15 seconds of demo start.
- Core transformation is visible within 30–45 seconds.

No ROI or willingness-to-pay number is claimed without user evidence.

## 14. Risks

- Thin differentiation vs SDP and generic orchestration.
- "Just claimable balances" perception.
- Testnet rate limits / resets.
- Self-seeded liquidity can look staged if not labeled.
- C-address branch may consume disproportionate time.
- No user interviews yet.
- Deadline and Canadian eligibility still require final authenticated/T&C confirmation.

## 15. Acceptance criteria for build authorization

Satisfied now:
- negative event grounded;
- Stellar removal test passed;
- live Strict Receive proven;
- live `op_no_trust` proven;
- live Claimable Balance claim proven;
- live time-bound reclaim proven;
- runtime receipt bound to exact commit.

Still required before BUILD_CANDIDATE_READY:
- operator product surface;
- representative live core loop;
- negative/boundary/recovery coverage;
- current evidence graph;
- reproducible judge path;
- deployment identity if a live URL is claimed;
- engineering-quality checks;
- Project Finisher terminal assurance;
- current pitch/demo/Q&A pack.

## 16. Definition of Done

The project is not done when one transaction succeeds.

Definition of Done requires:
- live operator flow;
- load-bearing Stellar behavior;
- real consequence;
- success + negative + boundary + recovery scenarios;
- honest UNKNOWN/NEEDS_HUMAN behavior;
- receipts;
- judge self-serve path;
- reproducible setup;
- current deployment/commit binding;
- post-vertical-slice depth review;
- terminal assurance and submission integrity.

## 17. Version history

- **v0.1 — 2026-10-02:** created after six-model pre-concept review and live Technical Reality Spike. Consumer route-to-cash, generic routing, Proof-to-Pay, MoneyGram hero, x402/MPP and generic AI routing removed.
