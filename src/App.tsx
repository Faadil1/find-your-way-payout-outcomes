import { useEffect, useMemo, useState } from "react";
import type {
  EvidenceEvent,
  OutcomeState,
  PayoutIntent,
  PayoutRecord,
  PreflightResult,
} from "./domain";
import { chooseSettlementPolicy } from "./domain";
import {
  EXPLORER,
  assetBalance,
  createDemoEnvironment,
  createTimeBoundClaimableBalance,
  event,
  executeStrictReceive,
  makeReadyAndClaim,
  preflightRecipient,
  reclaim,
  type DemoEnvironment,
} from "./stellar";

type BusyKey = "setup" | "naive" | "assured" | "claim" | "return" | "reclaim";

const allowedGuarantees: PayoutIntent["allowedSettlementGuarantees"] = [
  "STRICT_RECEIVE",
  "CLAIMABLE_BALANCE",
  "STOP_NEEDS_HUMAN",
];

function short(value?: string, left = 7, right = 5) {
  if (!value) return "—";
  if (value.length <= left + right + 1) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

function outcomeCopy(outcome?: OutcomeState) {
  switch (outcome) {
    case "USABLE":
      return "Usable";
    case "CLAIMABLE":
      return "Waiting safely";
    case "RETURNED":
      return "Returned";
    case "NEEDS_HUMAN":
      return "Needs human";
    case "FAILED_NO_FUNDS_MOVED":
      return "Failed · no funds moved";
    case "RECONCILING":
      return "Reconciling";
    default:
      return "Not executed";
  }
}

function makeIntent(
  id: string,
  recipient: string,
  issuer: string,
  amount = "10",
  maxSenderCost = "12",
): PayoutIntent {
  return {
    payoutId: id,
    recipient,
    exactDestinationAmount: amount,
    maxSenderCost,
    targetAssetCode: "POAUSD",
    targetAssetIssuer: issuer,
    claimTimeoutSeconds: 45,
    allowedSettlementGuarantees: allowedGuarantees,
  };
}

function ResultCode({ eventItem }: { eventItem: EvidenceEvent }) {
  if (!eventItem.resultCode) return null;
  return <code className="result-code">{eventItem.resultCode}</code>;
}

function EvidenceLink({ hash }: { hash?: string }) {
  if (!hash) return null;
  return (
    <a
      className="tx-link"
      href={`${EXPLORER}${hash}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open transaction ${hash} in Stellar Expert`}
    >
      {short(hash, 9, 7)} ↗
    </a>
  );
}

function RecipientRow({
  record,
  now,
}: {
  record: PayoutRecord;
  now: number;
}) {
  const seconds =
    record.cutoffEpoch != null
      ? Math.max(0, record.cutoffEpoch - Math.floor(now / 1000))
      : null;

  return (
    <article className="recipient-card">
      <div className="recipient-main">
        <div>
          <div className="eyebrow">Recipient</div>
          <h3>{record.name}</h3>
          <div className="mono muted">{short(record.recipient, 9, 7)}</div>
        </div>
        <span className={`outcome outcome-${(record.outcome || "unset").toLowerCase()}`}>
          {outcomeCopy(record.outcome)}
        </span>
      </div>

      <dl className="facts">
        <div>
          <dt>Capability</dt>
          <dd>{record.capability || "—"}</dd>
        </div>
        <div>
          <dt>Guarantee</dt>
          <dd>{record.guarantee || "—"}</dd>
        </div>
        <div>
          <dt>Next safe action</dt>
          <dd>{record.nextAction || "—"}</dd>
        </div>
        {seconds != null && record.outcome === "CLAIMABLE" ? (
          <div>
            <dt>Reclaim window</dt>
            <dd>{seconds > 0 ? `${seconds}s remaining` : "Treasury can reclaim now"}</dd>
          </div>
        ) : null}
      </dl>

      {record.events.length > 0 ? (
        <div className="mini-timeline">
          {record.events.slice(-3).map((ev) => (
            <div className="mini-event" key={ev.id}>
              <span className={`truth truth-${ev.label.toLowerCase()}`}>{ev.label}</span>
              <div>
                <strong>{ev.title}</strong>
                <p>{ev.detail}</p>
                <ResultCode eventItem={ev} />
                <EvidenceLink hash={ev.txHash} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function App() {
  const [env, setEnv] = useState<DemoEnvironment | null>(null);
  const [preflights, setPreflights] = useState<Record<string, PreflightResult>>({});
  const [records, setRecords] = useState<Record<string, PayoutRecord>>({});
  const [events, setEvents] = useState<EvidenceEvent[]>([]);
  const [busy, setBusy] = useState<Partial<Record<BusyKey, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const setBusyKey = (key: BusyKey, value: boolean) =>
    setBusy((current) => ({ ...current, [key]: value }));

  const appendGlobal = (ev: EvidenceEvent) =>
    setEvents((current) => [...current, ev]);

  const patchRecord = (id: string, patch: Partial<PayoutRecord>) =>
    setRecords((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
        events: patch.events ?? current[id]?.events ?? [],
      },
    }));

  const appendRecordEvent = (id: string, ev: EvidenceEvent) => {
    setRecords((current) => ({
      ...current,
      [id]: {
        ...current[id],
        events: [...(current[id]?.events || []), ev],
      },
    }));
    appendGlobal(ev);
  };

  async function setupDemo() {
    setBusyKey("setup", true);
    setError(null);
    try {
      const environment = await createDemoEnvironment(appendGlobal);
      setEnv(environment);

      const [readyPreflight, unreadyPreflight, returnPreflight] = await Promise.all([
        preflightRecipient(environment.ready.publicKey(), environment.asset),
        preflightRecipient(environment.unready.publicKey(), environment.asset),
        preflightRecipient(environment.returnOnly.publicKey(), environment.asset),
      ]);

      setPreflights({
        ready: readyPreflight,
        unready: unreadyPreflight,
        returnOnly: returnPreflight,
      });

      const readyIntent = makeIntent(
        "p-ready",
        environment.ready.publicKey(),
        environment.asset.issuer,
      );
      const unreadyIntent = makeIntent(
        "p-unready",
        environment.unready.publicKey(),
        environment.asset.issuer,
      );
      const returnIntent = makeIntent(
        "p-return",
        environment.returnOnly.publicKey(),
        environment.asset.issuer,
        "7",
        "9",
      );

      const readyDecision = chooseSettlementPolicy(readyIntent, readyPreflight);
      const unreadyDecision = chooseSettlementPolicy(unreadyIntent, unreadyPreflight);
      const returnDecision = chooseSettlementPolicy(returnIntent, returnPreflight);

      const readyEvent = event(
        "LIVE_TESTNET",
        "Capability preflight",
        readyDecision.reason,
      );
      const unreadyEvent = event(
        "LIVE_TESTNET",
        "Capability preflight",
        unreadyDecision.reason,
      );
      const returnEvent = event(
        "LIVE_TESTNET",
        "Capability preflight",
        "This recipient is reserved for a time-bound return demonstration.",
      );

      setRecords({
        ready: {
          id: "ready",
          name: "Ana · ready",
          recipient: environment.ready.publicKey(),
          capability: readyPreflight.capability,
          guarantee: readyDecision.guarantee,
          nextAction: "Execute exact delivery",
          events: [readyEvent],
        },
        unready: {
          id: "unready",
          name: "Ben · no trustline",
          recipient: environment.unready.publicKey(),
          capability: unreadyPreflight.capability,
          guarantee: unreadyDecision.guarantee,
          nextAction: "Hold safely, then claim after readiness",
          events: [unreadyEvent],
        },
        returnOnly: {
          id: "returnOnly",
          name: "Nia · inactive",
          recipient: environment.returnOnly.publicKey(),
          capability: returnPreflight.capability,
          guarantee: returnDecision.guarantee,
          nextAction: "Create time-bound hold",
          events: [returnEvent],
        },
      });

      setEvents((current) => [...current, readyEvent, unreadyEvent, returnEvent]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyKey("setup", false);
    }
  }

  async function runNaiveFailure() {
    if (!env || !preflights.unready) return;
    setBusyKey("naive", true);
    setError(null);
    try {
      const result = await executeStrictReceive(
        env.treasury,
        env.unready.publicKey(),
        env.asset,
      );
      const opCode = result.resultCodes?.operations?.[0] || "unknown";
      const provedNoTrust = !result.ok && opCode.includes("no_trust");

      const ev = event(
        "INDUCED_FAILURE",
        provedNoTrust ? "Naive payment rejected" : "Unexpected negative-path result",
        provedNoTrust
          ? "Ben cannot hold POAUSD. Retrying the same payment would not change that fact."
          : "The expected no-trust condition was not observed. Do not treat this as proof.",
        {
          txHash: result.txHash,
          resultCode: opCode,
          outcome: provedNoTrust ? "FAILED_NO_FUNDS_MOVED" : "NEEDS_HUMAN",
        },
      );

      patchRecord("unready", {
        outcome: provedNoTrust ? "FAILED_NO_FUNDS_MOVED" : "NEEDS_HUMAN",
        nextAction: provedNoTrust
          ? "Change settlement guarantee — do not retry"
          : "Inspect unexpected result",
      });
      appendRecordEvent("unready", ev);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyKey("naive", false);
    }
  }

  async function runAssuredBatch() {
    if (!env || !preflights.ready || !preflights.unready) return;
    setBusyKey("assured", true);
    setError(null);
    try {
      const before = await assetBalance(env.ready.publicKey(), env.asset);
      patchRecord("ready", {
        outcome: "RECONCILING",
        nextAction: "Wait for ledger confirmation",
      });

      const strict = await executeStrictReceive(
        env.treasury,
        env.ready.publicKey(),
        env.asset,
      );

      if (!strict.ok) {
        const code = strict.resultCodes?.operations?.[0] || strict.resultCodes?.transaction;
        const ev = event(
          "LIVE_TESTNET",
          "Exact delivery failed closed",
          "Strict Receive did not settle. Ana is not marked paid.",
          {
            txHash: strict.txHash,
            resultCode: code,
            outcome: "FAILED_NO_FUNDS_MOVED",
          },
        );
        patchRecord("ready", {
          outcome: "FAILED_NO_FUNDS_MOVED",
          nextAction: "Inspect route / sender bound",
        });
        appendRecordEvent("ready", ev);
      } else {
        const after = await assetBalance(env.ready.publicKey(), env.asset);
        const exact = Number(after) - Number(before) === 10;
        const ev = event(
          "LIVE_TESTNET",
          "Exact outcome verified",
          exact
            ? `Ana's spendable POAUSD balance increased by exactly 10.0000000.`
            : `Transaction settled, but the observed balance delta was ${Number(after) - Number(before)}. Outcome is not upgraded.`,
          {
            txHash: strict.txHash,
            outcome: exact ? "USABLE" : "NEEDS_HUMAN",
          },
        );
        patchRecord("ready", {
          outcome: exact ? "USABLE" : "NEEDS_HUMAN",
          nextAction: exact ? "No action" : "Reconcile balance evidence",
        });
        appendRecordEvent("ready", ev);
      }

      const latestUnready = await preflightRecipient(
        env.unready.publicKey(),
        env.asset,
      );
      setPreflights((current) => ({ ...current, unready: latestUnready }));
      const intent = makeIntent(
        "p-unready",
        env.unready.publicKey(),
        env.asset.issuer,
      );
      const decision = chooseSettlementPolicy(intent, latestUnready);

      if (decision.guarantee !== "CLAIMABLE_BALANCE") {
        const ev = event(
          "LIVE_TESTNET",
          "Policy stopped automatic execution",
          decision.reason,
          { outcome: "NEEDS_HUMAN" },
        );
        patchRecord("unready", {
          guarantee: decision.guarantee,
          outcome: "NEEDS_HUMAN",
          nextAction: "Human review",
        });
        appendRecordEvent("unready", ev);
        return;
      }

      const hold = await createTimeBoundClaimableBalance(
        env.treasury,
        env.unready.publicKey(),
        env.asset,
        "10",
        90,
      );
      const ev = event(
        "LIVE_TESTNET",
        "Different settlement guarantee created",
        "Instead of retrying a payment Ben cannot receive, 10 POAUSD is waiting in a time-bound claimable balance.",
        {
          txHash: hold.txHash,
          outcome: "CLAIMABLE",
        },
      );
      patchRecord("unready", {
        capability: latestUnready.capability,
        guarantee: "CLAIMABLE_BALANCE",
        outcome: "CLAIMABLE",
        nextAction: "Add trustline, then claim before cutoff",
        balanceId: hold.balanceId,
        cutoffEpoch: hold.cutoffEpoch,
      });
      appendRecordEvent("unready", ev);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyKey("assured", false);
    }
  }

  async function claimForBen() {
    if (!env || !records.unready?.balanceId) return;
    setBusyKey("claim", true);
    setError(null);
    try {
      const result = await makeReadyAndClaim(
        env.unready,
        env.asset,
        records.unready.balanceId,
      );
      if (!result.ok || !result.claim) {
        const ev = event(
          "LIVE_TESTNET",
          "Claim did not complete",
          "The recipient state remains unresolved; no success is inferred.",
          {
            txHash: result.trustline.txHash,
            outcome: "NEEDS_HUMAN",
          },
        );
        patchRecord("unready", {
          outcome: "NEEDS_HUMAN",
          nextAction: "Inspect trustline or claim failure",
        });
        appendRecordEvent("unready", ev);
        return;
      }

      const latest = await preflightRecipient(env.unready.publicKey(), env.asset);
      setPreflights((current) => ({ ...current, unready: latest }));
      const ev = event(
        "LIVE_TESTNET",
        "Claim verified",
        "Ben established the trustline and claimed the waiting balance. Outcome moved CLAIMABLE → USABLE.",
        {
          txHash: result.claim.txHash,
          outcome: "USABLE",
        },
      );
      patchRecord("unready", {
        capability: latest.capability,
        outcome: "USABLE",
        nextAction: "No action",
      });
      appendRecordEvent("unready", ev);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyKey("claim", false);
    }
  }

  async function startReturnDemo() {
    if (!env) return;
    setBusyKey("return", true);
    setError(null);
    try {
      const hold = await createTimeBoundClaimableBalance(
        env.treasury,
        env.returnOnly.publicKey(),
        env.asset,
        "7",
        30,
      );
      const ev = event(
        "LIVE_TESTNET",
        "Time-bound hold created",
        "Nia will not claim this balance. After the cutoff, the treasury becomes the valid claimant.",
        {
          txHash: hold.txHash,
          outcome: "CLAIMABLE",
        },
      );
      patchRecord("returnOnly", {
        guarantee: "CLAIMABLE_BALANCE",
        outcome: "CLAIMABLE",
        nextAction: "Wait for cutoff, then reclaim",
        balanceId: hold.balanceId,
        cutoffEpoch: hold.cutoffEpoch,
      });
      appendRecordEvent("returnOnly", ev);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyKey("return", false);
    }
  }

  async function reclaimForTreasury() {
    if (!env || !records.returnOnly?.balanceId) return;
    setBusyKey("reclaim", true);
    setError(null);
    try {
      patchRecord("returnOnly", {
        outcome: "RECONCILING",
        nextAction: "Verify treasury reclaim",
      });
      const result = await reclaim(env.treasury, records.returnOnly.balanceId);
      const ev = event(
        "LIVE_TESTNET",
        result.ok ? "Treasury reclaim verified" : "Reclaim failed closed",
        result.ok
          ? "The unclaimed balance returned to the payer after the configured cutoff."
          : "The reclaim did not settle. The UI will not report RETURNED.",
        {
          txHash: result.txHash,
          resultCode:
            result.resultCodes?.operations?.[0] || result.resultCodes?.transaction,
          outcome: result.ok ? "RETURNED" : "NEEDS_HUMAN",
        },
      );
      patchRecord("returnOnly", {
        outcome: result.ok ? "RETURNED" : "NEEDS_HUMAN",
        nextAction: result.ok ? "No action" : "Inspect reclaim result",
      });
      appendRecordEvent("returnOnly", ev);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyKey("reclaim", false);
    }
  }

  function downloadReceipt() {
    const publicRecords = Object.values(records).map((record) => ({
      ...record,
      secret: undefined,
    }));
    const receipt = {
      schema: "payout-outcomes/judge-receipt/v1",
      generatedAt: new Date().toISOString(),
      network: "Stellar Testnet",
      truthBoundary: {
        live: "Ledger actions and Horizon account/result evidence",
        induced:
          "The demo seeds its own order-book liquidity and deliberately creates a missing-trustline recipient.",
        notClaimed:
          "Fiat cash-out, MoneyGram, production anchors, x402/MPP, AI routing, C-address/SAC.",
      },
      records: publicRecords,
      events,
    };
    const blob = new Blob([JSON.stringify(receipt, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "payout-outcomes-receipt.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const readyForReclaim =
    records.returnOnly?.cutoffEpoch != null &&
    Math.floor(now / 1000) > records.returnOnly.cutoffEpoch + 2 &&
    records.returnOnly.outcome === "CLAIMABLE";

  const terminalCount = useMemo(
    () =>
      Object.values(records).filter((record) =>
        ["USABLE", "RETURNED", "NEEDS_HUMAN", "FAILED_NO_FUNDS_MOVED"].includes(
          record.outcome || "",
        ),
      ).length,
    [records],
  );

  return (
    <main>
      <header className="hero">
        <div className="topline">
          <span className="network-badge">LIVE TESTNET</span>
          <span>Stellar · outcome assurance</span>
        </div>
        <div className="hero-grid">
          <div>
            <p className="kicker">Payout Outcomes</p>
            <h1>“Sent” is not an outcome.</h1>
            <p className="lede">
              Every payout ends <strong>usable</strong>, <strong>waiting safely</strong>,
              <strong> returned</strong>, or <strong>explicitly unresolved</strong> —
              never merely sent.
            </p>
          </div>
          <aside className="truth-card">
            <div className="eyebrow">Truth boundary</div>
            <p>
              Ledger actions are live on Stellar Testnet. The demo seeds its own liquidity
              and deliberately creates one missing-trustline recipient.
            </p>
            <p className="muted">
              No fiat cash-out, MoneyGram, production anchor, x402/MPP, or AI routing claim.
            </p>
          </aside>
        </div>
      </header>

      <section className="control-panel" aria-labelledby="live-demo">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Live core loop</div>
            <h2 id="live-demo">Run the outcome test</h2>
          </div>
          <div className="progress-copy">
            {env ? `${terminalCount}/${Object.keys(records).length} terminal outcomes` : "No live batch yet"}
          </div>
        </div>

        {!env ? (
          <button className="primary giant" onClick={setupDemo} disabled={busy.setup}>
            {busy.setup ? "Preparing live Testnet…" : "Prepare live Testnet demo"}
          </button>
        ) : (
          <div className="action-grid">
            <button
              className="secondary"
              onClick={runNaiveFailure}
              disabled={busy.naive || !records.unready}
            >
              {busy.naive ? "Submitting…" : "1 · Show naive failure"}
              <span>Real op_no_trust</span>
            </button>
            <button
              className="primary"
              onClick={runAssuredBatch}
              disabled={busy.assured || records.ready?.outcome === "USABLE"}
            >
              {busy.assured ? "Executing…" : "2 · Run assured batch"}
              <span>Exact delivery + safe hold</span>
            </button>
            <button
              className="secondary"
              onClick={claimForBen}
              disabled={
                busy.claim ||
                !records.unready?.balanceId ||
                records.unready?.outcome !== "CLAIMABLE"
              }
            >
              {busy.claim ? "Claiming…" : "3 · Make Ben ready + claim"}
              <span>CLAIMABLE → USABLE</span>
            </button>
            <button
              className="secondary"
              onClick={startReturnDemo}
              disabled={busy.return || Boolean(records.returnOnly?.balanceId)}
            >
              {busy.return ? "Creating hold…" : "4 · Start return clock"}
              <span>30-second live cutoff</span>
            </button>
            <button
              className="secondary"
              onClick={reclaimForTreasury}
              disabled={busy.reclaim || !readyForReclaim}
            >
              {busy.reclaim
                ? "Reclaiming…"
                : readyForReclaim
                  ? "5 · Reclaim to treasury"
                  : "5 · Reclaim after cutoff"}
              <span>CLAIMABLE → RETURNED</span>
            </button>
            <button className="ghost" onClick={downloadReceipt} disabled={events.length === 0}>
              Export evidence receipt
              <span>JSON · public data only</span>
            </button>
          </div>
        )}

        {error ? (
          <div className="error-box" role="alert">
            <strong>Live step stopped.</strong>
            <span>{error}</span>
          </div>
        ) : null}
      </section>

      {env ? (
        <>
          <section className="recipients" aria-labelledby="outcomes">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Outcome contract</div>
                <h2 id="outcomes">One intent. Different guarantees.</h2>
              </div>
              <p className="section-note">
                Capability changes the operation type. UI state never outranks ledger evidence.
              </p>
            </div>
            <div className="recipient-grid">
              {Object.values(records).map((record) => (
                <RecipientRow key={record.id} record={record} now={now} />
              ))}
            </div>
          </section>

          <section className="evidence-section" aria-labelledby="evidence">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Receipts</div>
                <h2 id="evidence">What actually happened</h2>
              </div>
              <p className="section-note">
                Every claim below is labeled by evidence class.
              </p>
            </div>
            <div className="timeline">
              {events
                .slice()
                .reverse()
                .map((ev) => (
                  <article className="timeline-row" key={ev.id}>
                    <div className="timeline-time">
                      {new Date(ev.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                    <div className="timeline-body">
                      <div className="timeline-title">
                        <span className={`truth truth-${ev.label.toLowerCase()}`}>
                          {ev.label}
                        </span>
                        <strong>{ev.title}</strong>
                      </div>
                      <p>{ev.detail}</p>
                      <ResultCode eventItem={ev} />
                      <EvidenceLink hash={ev.txHash} />
                    </div>
                  </article>
                ))}
            </div>
          </section>
        </>
      ) : (
        <section className="pre-demo">
          <div className="pre-demo-card">
            <span className="number">01</span>
            <h3>Preflight capability</h3>
            <p>Check whether the recipient can actually hold the intended asset.</p>
          </div>
          <div className="pre-demo-card">
            <span className="number">02</span>
            <h3>Change the guarantee</h3>
            <p>A missing trustline changes the operation, not just the retry count.</p>
          </div>
          <div className="pre-demo-card">
            <span className="number">03</span>
            <h3>Reconcile the outcome</h3>
            <p>Usable, claimable, returned, or explicitly unresolved — with evidence.</p>
          </div>
        </section>
      )}

      <footer>
        <span>Payout Outcomes · Find Your Way</span>
        <span>Testnet only · no production funds</span>
      </footer>
    </main>
  );
}
