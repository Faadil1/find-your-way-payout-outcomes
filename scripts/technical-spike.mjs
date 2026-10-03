import fs from "node:fs/promises";
import path from "node:path";
import * as StellarSdk from "@stellar/stellar-sdk";

const HORIZON = process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
const FRIENDBOT = process.env.STELLAR_FRIENDBOT_URL || "https://friendbot.stellar.org";
const NETWORK = StellarSdk.Networks.TESTNET;
const server = new StellarSdk.Horizon.Server(HORIZON);
const OUT = path.resolve("evidence/technical-spike-receipt.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

async function fund(kp) {
  const r = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(kp.publicKey())}`);
  if (!r.ok) throw new Error(`Friendbot failed ${r.status}: ${await r.text()}`);
}

async function account(pk) {
  return server.loadAccount(pk);
}

async function submit(sourceKp, operations, memo = null) {
  const src = await account(sourceKp.publicKey());
  let b = new StellarSdk.TransactionBuilder(src, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK,
  });
  for (const op of operations) b = b.addOperation(op);
  if (memo) b = b.addMemo(memo);
  const tx = b.setTimeout(180).build();
  tx.sign(sourceKp);
  try {
    const res = await server.submitTransaction(tx);
    return { ok: true, hash: res.hash, ledger: res.ledger, raw: res };
  } catch (err) {
    const data = err?.response?.data;
    return {
      ok: false,
      message: err?.message || String(err),
      resultCodes: data?.extras?.result_codes || null,
      resultXdr: data?.extras?.result_xdr || null,
      envelopeXdr: data?.extras?.envelope_xdr || null,
    };
  }
}

async function getAssetBalance(pk, asset) {
  const a = await account(pk);
  const b = a.balances.find(
    (x) => x.asset_code === asset.code && x.asset_issuer === asset.issuer,
  );
  return b ? b.balance : null;
}

async function main() {
  const receipt = {
    schema: "payout-outcome-assurance-technical-spike/v1",
    startedAt: nowIso(),
    environment: { network: "TESTNET", horizon: HORIZON },
    truthBoundary: {
      live: ["Friendbot-funded testnet accounts", "classic Stellar operations", "Horizon receipts"],
      induced: ["self-seeded order-book liquidity", "deliberate missing trustline"],
      simulated: [],
      notImplemented: ["fiat cash-out", "MoneyGram", "multi-anchor failover", "C-address/SAC branch"],
    },
    checks: {},
  };

  const issuer = StellarSdk.Keypair.random();
  const treasury = StellarSdk.Keypair.random();
  const marketMaker = StellarSdk.Keypair.random();
  const ready = StellarSdk.Keypair.random();
  const notReady = StellarSdk.Keypair.random();
  const reclaimOnly = StellarSdk.Keypair.random();

  receipt.accounts = {
    issuer: issuer.publicKey(),
    treasury: treasury.publicKey(),
    marketMaker: marketMaker.publicKey(),
    ready: ready.publicKey(),
    notReady: notReady.publicKey(),
    reclaimOnly: reclaimOnly.publicKey(),
  };

  for (const kp of [issuer, treasury, marketMaker, ready, notReady, reclaimOnly]) {
    await fund(kp);
  }

  const asset = new StellarSdk.Asset("POAUSD", issuer.publicKey());
  receipt.asset = { code: asset.code, issuer: asset.issuer };

  for (const kp of [treasury, marketMaker, ready, reclaimOnly]) {
    const r = await submit(kp, [StellarSdk.Operation.changeTrust({ asset })]);
    if (!r.ok) throw new Error(`changeTrust failed for ${kp.publicKey()}: ${JSON.stringify(r)}`);
  }

  for (const [dest, amount] of [
    [treasury.publicKey(), "1000"],
    [marketMaker.publicKey(), "5000"],
  ]) {
    const r = await submit(issuer, [StellarSdk.Operation.payment({ destination: dest, asset, amount })]);
    if (!r.ok) throw new Error(`asset issuance failed: ${JSON.stringify(r)}`);
  }

  const offer = await submit(marketMaker, [
    StellarSdk.Operation.manageSellOffer({
      selling: asset,
      buying: StellarSdk.Asset.native(),
      amount: "1000",
      price: "1",
      offerId: "0",
    }),
  ]);
  if (!offer.ok) throw new Error(`liquidity seed failed: ${JSON.stringify(offer)}`);
  receipt.liquidity = { label: "INDUCED_SELF_SEEDED", txHash: offer.hash };

  const beforeReady = await getAssetBalance(ready.publicKey(), asset);
  const strict = await submit(treasury, [
    StellarSdk.Operation.pathPaymentStrictReceive({
      sendAsset: StellarSdk.Asset.native(),
      sendMax: "12",
      destination: ready.publicKey(),
      destAsset: asset,
      destAmount: "10",
      path: [],
    }),
  ]);
  const afterReady = await getAssetBalance(ready.publicKey(), asset);
  receipt.checks.strictReceiveExact = {
    status: strict.ok && Number(afterReady) - Number(beforeReady) === 10 ? "PROVEN" : "FAILED",
    txHash: strict.hash || null,
    before: beforeReady,
    after: afterReady,
    intendedExactDestinationAmount: "10",
    result: strict,
  };

  const noTrust = await submit(treasury, [
    StellarSdk.Operation.pathPaymentStrictReceive({
      sendAsset: StellarSdk.Asset.native(),
      sendMax: "12",
      destination: notReady.publicKey(),
      destAsset: asset,
      destAmount: "10",
      path: [],
    }),
  ]);
  const opCodes = noTrust?.resultCodes?.operations || [];
  receipt.checks.noTrustNegative = {
    status: !noTrust.ok && opCodes.some((x) => String(x).includes("no_trust")) ? "PROVEN" : "FAILED",
    expected: "op_no_trust",
    result: noTrust,
  };

  const claimCutoff = Math.floor(Date.now() / 1000) + 180;
  const recipientBefore = StellarSdk.Claimant.predicateBeforeAbsoluteTime(String(claimCutoff));
  const payerAfter = StellarSdk.Claimant.predicateNot(
    StellarSdk.Claimant.predicateBeforeAbsoluteTime(String(claimCutoff)),
  );
  const createSource = await account(treasury.publicKey());
  const createTx = new StellarSdk.TransactionBuilder(createSource, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      StellarSdk.Operation.createClaimableBalance({
        asset,
        amount: "10",
        claimants: [
          new StellarSdk.Claimant(notReady.publicKey(), recipientBefore),
          new StellarSdk.Claimant(treasury.publicKey(), payerAfter),
        ],
      }),
    )
    .setTimeout(180)
    .build();
  const balanceId = createTx.getClaimableBalanceId(0);
  createTx.sign(treasury);
  const createRes = await server.submitTransaction(createTx);

  const trustRes = await submit(notReady, [StellarSdk.Operation.changeTrust({ asset })]);
  const claimRes = await submit(notReady, [
    StellarSdk.Operation.claimClaimableBalance({ balanceId }),
  ]);
  receipt.checks.claimableCreateAndClaim = {
    status: createRes?.successful !== false && trustRes.ok && claimRes.ok ? "PROVEN" : "FAILED",
    createTxHash: createRes.hash,
    balanceId,
    trustlineTxHash: trustRes.hash || null,
    claimTxHash: claimRes.hash || null,
  };

  const reclaimCutoff = Math.floor(Date.now() / 1000) + 45;
  const receiverBefore = StellarSdk.Claimant.predicateBeforeAbsoluteTime(String(reclaimCutoff));
  const treasuryAfter = StellarSdk.Claimant.predicateNot(
    StellarSdk.Claimant.predicateBeforeAbsoluteTime(String(reclaimCutoff)),
  );
  const reclaimSource = await account(treasury.publicKey());
  const reclaimTx = new StellarSdk.TransactionBuilder(reclaimSource, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      StellarSdk.Operation.createClaimableBalance({
        asset,
        amount: "7",
        claimants: [
          new StellarSdk.Claimant(reclaimOnly.publicKey(), receiverBefore),
          new StellarSdk.Claimant(treasury.publicKey(), treasuryAfter),
        ],
      }),
    )
    .setTimeout(180)
    .build();
  const reclaimBalanceId = reclaimTx.getClaimableBalanceId(0);
  reclaimTx.sign(treasury);
  const reclaimCreate = await server.submitTransaction(reclaimTx);
  receipt.checks.timeBoundReclaim = {
    status: "WAITING_FOR_CUTOFF",
    createTxHash: reclaimCreate.hash,
    balanceId: reclaimBalanceId,
    cutoffEpoch: reclaimCutoff,
  };

  while (Math.floor(Date.now() / 1000) <= reclaimCutoff + 6) await sleep(3000);
  const reclaimResult = await submit(treasury, [
    StellarSdk.Operation.claimClaimableBalance({ balanceId: reclaimBalanceId }),
  ]);
  receipt.checks.timeBoundReclaim.status = reclaimResult.ok ? "PROVEN" : "FAILED";
  receipt.checks.timeBoundReclaim.reclaimTxHash = reclaimResult.hash || null;
  receipt.checks.timeBoundReclaim.result = reclaimResult;

  receipt.checks.contractAddressSac = {
    status: "DEFERRED_NOT_CLAIMED",
    reason: "Separate Soroban/SAC transaction path; not required for first technical gate. Fail closed rather than simulate.",
  };

  receipt.finishedAt = nowIso();
  const required = [
    receipt.checks.strictReceiveExact.status,
    receipt.checks.noTrustNegative.status,
    receipt.checks.claimableCreateAndClaim.status,
    receipt.checks.timeBoundReclaim.status,
  ];
  receipt.technicalRealityGate = required.every((x) => x === "PROVEN") ? "PROVEN_WITH_SAC_DEFERRED" : "BLOCKED";

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
}

main().catch(async (err) => {
  const failure = {
    schema: "payout-outcome-assurance-technical-spike/v1",
    status: "BLOCKED",
    observedAt: nowIso(),
    error: err?.stack || String(err),
    note: "A failed spike is evidence. Do not upgrade product state until the failing mechanism is understood and rerun.",
  };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(failure, null, 2));
  console.error(failure);
  process.exit(1);
});
