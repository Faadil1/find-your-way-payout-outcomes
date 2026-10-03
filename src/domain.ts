export type OutcomeState =
  | "USABLE"
  | "CLAIMABLE"
  | "RETURNED"
  | "NEEDS_HUMAN"
  | "FAILED_NO_FUNDS_MOVED"
  | "RECONCILING";

export type CapabilityClass =
  | "READY_CLASSIC"
  | "NO_TARGET_TRUSTLINE"
  | "ACCOUNT_NOT_FOUND"
  | "UNSUPPORTED_OR_UNKNOWN";

export type SettlementGuarantee =
  | "STRICT_RECEIVE"
  | "DIRECT_PAYMENT"
  | "CLAIMABLE_BALANCE"
  | "STOP_NEEDS_HUMAN";

export type TruthLabel =
  | "LIVE_TESTNET"
  | "INDUCED_FAILURE"
  | "SIMULATED"
  | "NOT_IMPLEMENTED";

export interface PayoutIntent {
  payoutId: string;
  recipient: string;
  exactDestinationAmount: string;
  maxSenderCost: string;
  targetAssetCode: string;
  targetAssetIssuer: string;
  claimTimeoutSeconds: number;
  allowedSettlementGuarantees: SettlementGuarantee[];
}

export interface PreflightResult {
  recipient: string;
  capability: CapabilityClass;
  accountExists: boolean;
  hasTargetTrustline: boolean;
  observedAt: string;
  evidence: string[];
}

export interface SettlementDecision {
  guarantee: SettlementGuarantee;
  targetOutcome: OutcomeState;
  reason: string;
  automatic: boolean;
}

export interface EvidenceEvent {
  id: string;
  at: string;
  label: TruthLabel;
  title: string;
  detail: string;
  txHash?: string;
  resultCode?: string;
  outcome?: OutcomeState;
}

export interface PayoutRecord {
  id: string;
  name: string;
  recipient: string;
  capability?: CapabilityClass;
  guarantee?: SettlementGuarantee;
  outcome?: OutcomeState;
  nextAction?: string;
  balanceId?: string;
  cutoffEpoch?: number;
  events: EvidenceEvent[];
}

export function chooseSettlementPolicy(
  intent: PayoutIntent,
  preflight: PreflightResult,
): SettlementDecision {
  if (preflight.capability === "READY_CLASSIC") {
    if (intent.allowedSettlementGuarantees.includes("STRICT_RECEIVE")) {
      return {
        guarantee: "STRICT_RECEIVE",
        targetOutcome: "USABLE",
        automatic: true,
        reason: "Recipient can already hold the target asset; exact-amount settlement is allowed.",
      };
    }
    if (intent.allowedSettlementGuarantees.includes("DIRECT_PAYMENT")) {
      return {
        guarantee: "DIRECT_PAYMENT",
        targetOutcome: "USABLE",
        automatic: true,
        reason: "Recipient can hold the asset and direct payment is explicitly allowed.",
      };
    }
  }

  if (
    preflight.capability === "NO_TARGET_TRUSTLINE" &&
    intent.allowedSettlementGuarantees.includes("CLAIMABLE_BALANCE")
  ) {
    return {
      guarantee: "CLAIMABLE_BALANCE",
      targetOutcome: "CLAIMABLE",
      automatic: true,
      reason:
        "Recipient account exists but cannot hold the target asset yet. Use a time-bound claimable balance instead of blind retry.",
    };
  }

  return {
    guarantee: "STOP_NEEDS_HUMAN",
    targetOutcome: "NEEDS_HUMAN",
    automatic: false,
    reason:
      "No supported settlement guarantee is safe for the observed recipient capability.",
  };
}

export function canSubmitNewPayment(outcome?: OutcomeState): boolean {
  return outcome !== "RECONCILING";
}

export function isTerminalEvidenceState(outcome?: OutcomeState): boolean {
  return (
    outcome === "USABLE" ||
    outcome === "RETURNED" ||
    outcome === "NEEDS_HUMAN" ||
    outcome === "FAILED_NO_FUNDS_MOVED"
  );
}
