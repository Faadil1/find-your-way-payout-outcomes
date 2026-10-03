import * as StellarSdk from "@stellar/stellar-sdk";
import type {
  CapabilityClass,
  EvidenceEvent,
  PreflightResult,
  TruthLabel,
} from "./domain";

export const HORIZON_URL =
  import.meta.env.VITE_STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
export const FRIENDBOT_URL =
  import.meta.env.VITE_STELLAR_FRIENDBOT_URL || "https://friendbot.stellar.org";
export const NETWORK = StellarSdk.Networks.TESTNET;
export const EXPLORER = "https://stellar.expert/explorer/testnet/tx/";

export const server = new StellarSdk.Horizon.Server(HORIZON_URL);

export interface SubmitResult {
  ok: boolean;
  txHash: string;
  ledger?: number;
  resultCodes?: {
    transaction?: string;
    operations?: string[];
  } | null;
  resultXdr?: string | null;
  message?: string;
}

export interface DemoEnvironment {
  issuer: StellarSdk.Keypair;
  treasury: StellarSdk.Keypair;
  marketMaker: StellarSdk.Keypair;
  ready: StellarSdk.Keypair;
  unready: StellarSdk.Keypair;
  returnOnly: StellarSdk.Keypair;
  asset: StellarSdk.Asset;
  liquidityTxHash: string;
  setupEvidence: EvidenceEvent[];
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function event(
  label: TruthLabel,
  title: string,
  detail: string,
  extra: Partial<EvidenceEvent> = {},
): EvidenceEvent {
  return {
    id: uid("ev"),
    at: new Date().toISOString(),
    label,
    title,
    detail,
    ...extra,
  };
}

export async function fund(kp: StellarSdk.Keypair) {
  const response = await fetch(
    `${FRIENDBOT_URL}?addr=${encodeURIComponent(kp.publicKey())}`,
  );
  if (!response.ok) {
    throw new Error(`Friendbot failed ${response.status}: ${await response.text()}`);
  }
}

export async function loadAccount(publicKey: string) {
  return server.loadAccount(publicKey);
}

export async function submit(
  source: StellarSdk.Keypair,
  operations: StellarSdk.xdr.Operation[],
): Promise<SubmitResult> {
  const sourceAccount = await loadAccount(source.publicKey());
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK,
  });

  for (const operation of operations) tx.addOperation(operation);

  const built = tx.setTimeout(180).build();
  const txHash = Array.from(built.hash()).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  built.sign(source);

  try {
    const result = await server.submitTransaction(built);
    return {
      ok: true,
      txHash: result.hash,
      ledger: result.ledger,
      resultCodes: null,
    };
  } catch (error) {
    const maybe = error as {
      message?: string;
      response?: {
        data?: {
          extras?: {
            result_codes?: {
              transaction?: string;
              operations?: string[];
            };
            result_xdr?: string;
          };
        };
      };
    };
    return {
      ok: false,
      txHash,
      message: maybe.message || "Stellar transaction failed",
      resultCodes: maybe.response?.data?.extras?.result_codes || null,
      resultXdr: maybe.response?.data?.extras?.result_xdr || null,
    };
  }
}

export async function hasTrustline(
  publicKey: string,
  asset: StellarSdk.Asset,
): Promise<boolean> {
  const account = await loadAccount(publicKey);
  return account.balances.some(
    (balance) =>
      "asset_code" in balance &&
      balance.asset_code === asset.code &&
      "asset_issuer" in balance &&
      balance.asset_issuer === asset.issuer,
  );
}

export async function preflightRecipient(
  publicKey: string,
  asset: StellarSdk.Asset,
): Promise<PreflightResult> {
  try {
    const account = await loadAccount(publicKey);
    const trustline = account.balances.some(
      (balance) =>
        "asset_code" in balance &&
        balance.asset_code === asset.code &&
        "asset_issuer" in balance &&
        balance.asset_issuer === asset.issuer,
    );

    const capability: CapabilityClass = trustline
      ? "READY_CLASSIC"
      : "NO_TARGET_TRUSTLINE";

    return {
      recipient: publicKey,
      capability,
      accountExists: true,
      hasTargetTrustline: trustline,
      observedAt: new Date().toISOString(),
      evidence: [
        `Horizon account lookup succeeded for ${publicKey}`,
        trustline
          ? `Target trustline ${asset.code} is present`
          : `Target trustline ${asset.code} is missing`,
      ],
    };
  } catch (error) {
    const maybe = error as { response?: { status?: number }; message?: string };
    if (maybe.response?.status === 404) {
      return {
        recipient: publicKey,
        capability: "ACCOUNT_NOT_FOUND",
        accountExists: false,
        hasTargetTrustline: false,
        observedAt: new Date().toISOString(),
        evidence: ["Horizon account lookup returned 404"],
      };
    }
    return {
      recipient: publicKey,
      capability: "UNSUPPORTED_OR_UNKNOWN",
      accountExists: false,
      hasTargetTrustline: false,
      observedAt: new Date().toISOString(),
      evidence: [maybe.message || "Preflight failed with unknown error"],
    };
  }
}

export async function assetBalance(publicKey: string, asset: StellarSdk.Asset) {
  const account = await loadAccount(publicKey);
  const line = account.balances.find(
    (balance) =>
      "asset_code" in balance &&
      balance.asset_code === asset.code &&
      "asset_issuer" in balance &&
      balance.asset_issuer === asset.issuer,
  );
  return line && "balance" in line ? line.balance : null;
}

export async function createDemoEnvironment(
  onEvidence?: (ev: EvidenceEvent) => void,
): Promise<DemoEnvironment> {
  const issuer = StellarSdk.Keypair.random();
  const treasury = StellarSdk.Keypair.random();
  const marketMaker = StellarSdk.Keypair.random();
  const ready = StellarSdk.Keypair.random();
  const unready = StellarSdk.Keypair.random();
  const returnOnly = StellarSdk.Keypair.random();
  const all = [issuer, treasury, marketMaker, ready, unready, returnOnly];

  const setupEvidence: EvidenceEvent[] = [];
  const emit = (ev: EvidenceEvent) => {
    setupEvidence.push(ev);
    onEvidence?.(ev);
  };

  for (const kp of all) {
    await fund(kp);
  }
  emit(
    event(
      "LIVE_TESTNET",
      "Fresh Testnet accounts funded",
      "Six ephemeral accounts were created and funded through Friendbot. Secret keys remain only in this browser session.",
    ),
  );

  const asset = new StellarSdk.Asset("POAUSD", issuer.publicKey());

  for (const kp of [treasury, marketMaker, ready, returnOnly]) {
    const result = await submit(kp, [
      StellarSdk.Operation.changeTrust({ asset }),
    ]);
    if (!result.ok) throw new Error(`Trustline setup failed: ${result.message}`);
  }

  for (const [destination, amount] of [
    [treasury.publicKey(), "1000"],
    [marketMaker.publicKey(), "5000"],
  ] as const) {
    const result = await submit(issuer, [
      StellarSdk.Operation.payment({
        destination,
        asset,
        amount,
      }),
    ]);
    if (!result.ok) throw new Error(`Test asset issuance failed: ${result.message}`);
  }

  const liquidity = await submit(marketMaker, [
    StellarSdk.Operation.manageSellOffer({
      selling: asset,
      buying: StellarSdk.Asset.native(),
      amount: "1000",
      price: "1",
      offerId: "0",
    }),
  ]);
  if (!liquidity.ok) throw new Error(`Liquidity seed failed: ${liquidity.message}`);

  emit(
    event(
      "INDUCED_FAILURE",
      "Deterministic test liquidity seeded",
      "The demo seeded its own POAUSD/XLM order-book offer. This is live Testnet liquidity created solely for deterministic testing.",
      { txHash: liquidity.txHash },
    ),
  );

  return {
    issuer,
    treasury,
    marketMaker,
    ready,
    unready,
    returnOnly,
    asset,
    liquidityTxHash: liquidity.txHash,
    setupEvidence,
  };
}

export async function executeStrictReceive(
  treasury: StellarSdk.Keypair,
  recipient: string,
  asset: StellarSdk.Asset,
  amount = "10",
  maxSend = "12",
) {
  return submit(treasury, [
    StellarSdk.Operation.pathPaymentStrictReceive({
      sendAsset: StellarSdk.Asset.native(),
      sendMax: maxSend,
      destination: recipient,
      destAsset: asset,
      destAmount: amount,
      path: [],
    }),
  ]);
}

export async function createTimeBoundClaimableBalance(
  treasury: StellarSdk.Keypair,
  recipient: string,
  asset: StellarSdk.Asset,
  amount: string,
  timeoutSeconds: number,
) {
  const cutoffEpoch = Math.floor(Date.now() / 1000) + timeoutSeconds;
  const recipientBefore = StellarSdk.Claimant.predicateBeforeAbsoluteTime(
    String(cutoffEpoch),
  );
  const payerAfter = StellarSdk.Claimant.predicateNot(
    StellarSdk.Claimant.predicateBeforeAbsoluteTime(String(cutoffEpoch)),
  );

  const source = await loadAccount(treasury.publicKey());
  const tx = new StellarSdk.TransactionBuilder(source, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      StellarSdk.Operation.createClaimableBalance({
        asset,
        amount,
        claimants: [
          new StellarSdk.Claimant(recipient, recipientBefore),
          new StellarSdk.Claimant(treasury.publicKey(), payerAfter),
        ],
      }),
    )
    .setTimeout(180)
    .build();

  const balanceId = tx.getClaimableBalanceId(0);
  tx.sign(treasury);
  const result = await server.submitTransaction(tx);

  return {
    ok: true as const,
    txHash: result.hash,
    ledger: result.ledger,
    balanceId,
    cutoffEpoch,
  };
}

export async function makeReadyAndClaim(
  recipient: StellarSdk.Keypair,
  asset: StellarSdk.Asset,
  balanceId: string,
) {
  const trustline = await submit(recipient, [
    StellarSdk.Operation.changeTrust({ asset }),
  ]);
  if (!trustline.ok) {
    return { ok: false as const, trustline, claim: null };
  }

  const claim = await submit(recipient, [
    StellarSdk.Operation.claimClaimableBalance({ balanceId }),
  ]);
  return { ok: claim.ok, trustline, claim };
}

export async function reclaim(
  treasury: StellarSdk.Keypair,
  balanceId: string,
) {
  return submit(treasury, [
    StellarSdk.Operation.claimClaimableBalance({ balanceId }),
  ]);
}
