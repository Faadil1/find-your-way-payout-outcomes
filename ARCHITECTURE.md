# Architecture — Payout Outcomes v0.1

## Architecture objective

Make Stellar recipient capability and live ledger state causally determine settlement behavior, while keeping the judge-facing build small, deterministic, and evidence-rich.

## Logical components

### 1. Intent Model
Canonical fields:
- payout_id
- recipient
- target_asset
- exact_destination_amount
- max_sender_cost
- claim_timeout_policy
- allowed_settlement_guarantees

### 2. Capability Preflight
Reads live Stellar state and returns a bounded capability class.

Initial classes:
- `READY_CLASSIC`
- `NO_TARGET_TRUSTLINE`
- `ACCOUNT_NOT_FOUND`
- `UNSUPPORTED_OR_UNKNOWN`

Deferred:
- `CONTRACT_ADDRESS`

No LLM participates in classification.

### 3. Settlement Policy Engine
Pure deterministic mapping from intent + capability + current evidence to:
- `STRICT_RECEIVE`
- `DIRECT_PAYMENT`
- `CLAIMABLE_BALANCE`
- `STOP_NEEDS_HUMAN`

The engine also emits a human-readable reason.

### 4. Stellar Execution Adapter
Owns transaction construction/sign/submit for:
- changeTrust in judge-controlled recipient demo;
- Strict Receive;
- create Claimable Balance;
- claim Claimable Balance;
- treasury reclaim.

All live execution is Testnet in v1.

### 5. Reconciler
Never trusts optimistic UI state.

Reads Horizon/result state and maps to:
- USABLE
- CLAIMABLE
- RETURNED
- NEEDS_HUMAN
- FAILED_NO_FUNDS_MOVED
- RECONCILING

If submission state is uncertain, it returns RECONCILING and blocks duplicate execution until ledger reconciliation.

### 6. Evidence / Receipt Builder
For each transition stores:
- intent snapshot;
- capability snapshot;
- policy decision;
- truth-boundary label;
- runtime network;
- tx hash / result code;
- observed timestamp;
- resulting outcome.

### 7. Operator UI
Primary judge surface. It should show state transition, not charts.

### 8. Recipient Claim UI
A small surface for the demo recipient to establish readiness and claim a balance.

## Recommended implementation stack

- Vite + React + TypeScript.
- `@stellar/stellar-sdk`.
- Direct Horizon/Friendbot access for Testnet demo operations.
- No required production backend for first slice.
- Session-local state may be used for non-authoritative UI convenience; ledger/result evidence remains authoritative.
- Deployment target can be a static host such as Vercel after local/CI proof.

Why this shape:
- minimizes deployment and secret-management surface;
- supports self-serve judge execution;
- keeps the live chain behavior visible;
- avoids introducing a database before it creates user value.

## Testnet key model

The judge demo may generate ephemeral Testnet keypairs inside the session. They carry no real funds and are for deterministic test execution only.

Requirements:
- visibly label TESTNET;
- never reuse this pattern for mainnet;
- never persist secrets to Git, analytics, logs, receipts, or public UI;
- receipts contain public keys and tx hashes only.

## State machine

```
INTENT_CREATED
  → PREFLIGHTED
  → POLICY_SELECTED
  → EXECUTION_SUBMITTED
  → RECONCILING
  → USABLE
  → CLAIMABLE
  → RETURNED
  → NEEDS_HUMAN
  → FAILED_NO_FUNDS_MOVED
```

Allowed transitions are policy constrained; terminal-looking UI must not skip evidence.

## Initial policy table

| Capability / runtime condition | Action | Outcome target |
|---|---|---|
| Ready classic account + valid exact route | Strict Receive | USABLE |
| Classic account missing target trustline | Claimable Balance | CLAIMABLE |
| Claimable recipient becomes ready | Claim | USABLE |
| Claim window expires | Treasury reclaim | RETURNED |
| No route within sender bound | Stop | FAILED_NO_FUNDS_MOVED / NEEDS_HUMAN |
| Unknown submission result | Reconcile only | RECONCILING |
| Unsupported recipient type | Stop | NEEDS_HUMAN |

## Evidence architecture

Every material claim must map through:

`CLAIM → SCENARIO → RUNTIME_EXECUTION → DEPENDENCY → RECEIPT → COMMIT → DEPLOYMENT`

During local/CI work, deployment may be N/A. Once a public judge URL is claimed, deployment binding becomes mandatory.

## Deferred architecture

Do not add before core depth review:
- database;
- accounts/auth;
- production custody;
- C-address/SAC;
- anchors/SEP-24/31;
- MoneyGram;
- x402/MPP;
- AI agents;
- custom Soroban contracts.

They reactivate only if the product core creates a real need.
