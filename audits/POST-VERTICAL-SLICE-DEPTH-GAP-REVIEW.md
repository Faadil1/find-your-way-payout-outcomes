# Post-Vertical-Slice Product Depth Gap Review — 2026-10-03

Status: **ACTIVE — vertical slice is not Definition of Done**

## Proven depth

- Real operator-facing UI exists.
- Capability preflight reads live Stellar state.
- Ready recipient uses a different settlement policy from an unready recipient.
- Strict Receive exact delivery is live.
- A real `op_no_trust` negative path is visible.
- Recovery changes settlement guarantee rather than repeating the same operation.
- Recipient claim is live.
- Treasury reclaim is live.
- Evidence timeline and exported JSON receipt exist.
- Browser automation proved the full primary flow.

## Material gaps that still block BUILD_CANDIDATE_READY

### 1. Boundary / cost guard not yet product-proven

The product must visibly show that an exact-outcome request stops when `sendMax` cannot satisfy the path. Expected outcome: no settlement and an explicit bounded failure, not silent amount degradation.

### 2. RECONCILING / anti-duplicate behavior not yet product-proven

The invariant exists in the domain model and unit tests, but the product has not yet demonstrated a live transaction whose client response is intentionally treated as uncertain and reconciled from the ledger before any retry is allowed.

### 3. Public judge runtime missing

The current proof runs inside CI. A judge needs a stable public URL after local/CI confidence exists.

### 4. Clean public-host run missing

Once deployed, the exact judge path must be rerun from the hosted build and bound to the deployed commit.

### 5. Deployment evidence graph missing

A public runtime claim requires commit → deployment identity → URL binding.

### 6. User evidence remains weak

The negative event is documented and technically real, but operator willingness-to-pay and workflow frequency are still hypotheses. This does not block the next product-depth build, but it must not be overstated in the pitch.

### 7. C-address / SAC remains intentionally deferred

It is still N/A for v1 unless a separate marginal-value review shows it materially improves the hero workflow without threatening deadline reliability.

## Exact next gate

**NEGATIVE_BOUNDARY_RECONCILIATION_DEPTH**

Pass condition:
- live boundary/cost-cap failure from the product UI;
- live reconciliation after an intentionally lost client response;
- duplicate execution visibly blocked while outcome is unknown;
- browser CI evidence captured and commit-bound.


## Phase 2 closure — 2026-10-03

The two material product-depth gaps targeted immediately after the vertical slice are now closed with browser + live Testnet evidence.

- **Sender-cost boundary:** PROVEN. Tight `sendMax` produced `op_over_source_max`; no settlement occurred; the product preserved the exact recipient outcome invariant.
- **RECONCILING / anti-duplicate:** PROVEN. One real payment was broadcast, the client response was intentionally discarded, retry was blocked, Horizon reconciled the original transaction, and recipient balance increased exactly once.

Evidence: `evidence/BOUNDARY-RECONCILIATION-DEPTH-RECEIPT.md`.

Remaining gaps are runtime/assurance gaps rather than missing core product behavior: public judge deployment, clean hosted run, deployment binding, accessibility/engineering quality, judge story/demo/Q&A, Project Finisher, and submission integrity.
