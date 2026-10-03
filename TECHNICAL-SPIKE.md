# Payout Outcome Assurance — Technical Reality Spike

Status: **PRE-BUILD / NON-PROMOTED**  
Network: **Stellar Testnet only**  
Purpose: falsify the core mechanism before consequential product build.

## Concept under test

A Stellar-native payout outcome assurance layer. The product does **not** claim that routing, retry, claimable balances, or smart wallets are novel primitives. The proposed value is a uniform outcome contract over heterogeneous recipient capabilities:

`Intent → Capability Preflight → Settlement Policy → Execute → Reconcile → Outcome → Receipt`

Allowed terminal outcome labels for the first build:

- `USABLE`
- `CLAIMABLE`
- `RETURNED`
- `NEEDS_HUMAN`
- `FAILED_NO_FUNDS_MOVED`
- `RECONCILING`

## Required technical proofs

1. **StrictReceive exact delivery** — a real testnet path payment delivers an exact destination amount with bounded sender cost.
2. **Negative path / no trustline** — a real testnet operation fails with `op_no_trust` when the recipient cannot hold the target asset.
3. **Different settlement guarantee** — create a claimable balance for the unready recipient, establish the trustline, and claim it.
4. **Safe return** — a time-bound claimable balance becomes reclaimable by the treasury and is actually reclaimed.
5. **C-address/SAC** — intentionally **deferred** for the first gate. It may move to ACTIVE only after the first four proofs pass and a separate spike shows that it materially improves the hero workflow before deadline.

## Truth boundary

### LIVE_TESTNET
Friendbot-funded accounts, trustlines, custom test asset, order-book offer, strict-receive transaction, failure result code, claimable-balance create/claim/reclaim, Horizon receipts.

### INDUCED_FAILURE
The order-book liquidity is seeded by the spike and the missing trustline is deliberate. They are real Stellar states, but self-created for deterministic testing.

### NOT_IMPLEMENTED
Fiat cash-out, MoneyGram, production anchors, multi-anchor failover, x402/MPP, proof-to-pay, generic AI routing, custom Soroban escrow.

## Run

```bash
npm install
npm run spike
```

Expected artifact:

`evidence/technical-spike-receipt.json`

## Promotion rule

The Technical Reality Gate is `PROVEN_WITH_SAC_DEFERRED` only if the first four mechanisms are observed live on testnet. Anything else is `BLOCKED`. A docs-only result is not proof.
