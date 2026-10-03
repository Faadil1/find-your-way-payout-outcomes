# Payout Outcome Assurance — Find Your Way

This repository is the canonical project workspace for the Find Your Way hackathon build.

**Current state:** provisional concept lock, pre-build Technical Reality Spike.  
**Current branch:** `spike/technical-reality`  
**Build authority:** spike-only until the Technical Reality Gate is proven.

The concept under test is not a generic payment router. It is a Stellar-native payout outcome assurance layer:

`Intent → Capability Preflight → Settlement Policy → Execute → Reconcile → Outcome → Receipt`

Allowed first-build outcome labels:

- `USABLE`
- `CLAIMABLE`
- `RETURNED`
- `NEEDS_HUMAN`
- `FAILED_NO_FUNDS_MOVED`
- `RECONCILING`

The first spike must prove on Stellar Testnet:

1. Strict Receive exact delivery with bounded sender cost.
2. A real `op_no_trust` negative path.
3. Claimable Balance create → trustline → claim.
4. Time-bound Claimable Balance → treasury reclaim.

C-address/SAC support is deferred until those four mechanisms pass.

See `TECHNICAL-SPIKE.md`, `CONDITIONAL-GATEWAY-REGISTRY.yaml`, `EVIDENCE-GRAPH-SEED.yaml`, and `state/`.

A green CI run is necessary but not sufficient for promotion. The generated receipt must be inspected and bound to the exact commit.
