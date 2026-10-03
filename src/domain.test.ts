import { describe, expect, it } from "vitest";
import {
  canSubmitNewPayment,
  chooseSettlementPolicy,
  type PayoutIntent,
  type PreflightResult,
} from "./domain";

const intent: PayoutIntent = {
  payoutId: "p-1",
  recipient: "GTEST",
  exactDestinationAmount: "10",
  maxSenderCost: "12",
  targetAssetCode: "POAUSD",
  targetAssetIssuer: "GISSUER",
  claimTimeoutSeconds: 45,
  allowedSettlementGuarantees: [
    "STRICT_RECEIVE",
    "CLAIMABLE_BALANCE",
    "STOP_NEEDS_HUMAN",
  ],
};

function preflight(capability: PreflightResult["capability"]): PreflightResult {
  return {
    recipient: "GTEST",
    capability,
    accountExists: capability !== "ACCOUNT_NOT_FOUND",
    hasTargetTrustline: capability === "READY_CLASSIC",
    observedAt: new Date(0).toISOString(),
    evidence: [],
  };
}

describe("settlement policy", () => {
  it("uses strict receive for a ready classic recipient", () => {
    expect(chooseSettlementPolicy(intent, preflight("READY_CLASSIC"))).toMatchObject({
      guarantee: "STRICT_RECEIVE",
      targetOutcome: "USABLE",
      automatic: true,
    });
  });

  it("changes guarantee instead of retrying when the target trustline is missing", () => {
    expect(chooseSettlementPolicy(intent, preflight("NO_TARGET_TRUSTLINE"))).toMatchObject({
      guarantee: "CLAIMABLE_BALANCE",
      targetOutcome: "CLAIMABLE",
      automatic: true,
    });
  });

  it("fails closed for unsupported or unknown capability", () => {
    expect(
      chooseSettlementPolicy(intent, preflight("UNSUPPORTED_OR_UNKNOWN")),
    ).toMatchObject({
      guarantee: "STOP_NEEDS_HUMAN",
      targetOutcome: "NEEDS_HUMAN",
      automatic: false,
    });
  });

  it("blocks duplicate execution during reconciliation", () => {
    expect(canSubmitNewPayment("RECONCILING")).toBe(false);
    expect(canSubmitNewPayment("FAILED_NO_FUNDS_MOVED")).toBe(true);
  });
});
