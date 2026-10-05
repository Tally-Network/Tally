"use client";
/**
 * Verifies the published round in the browser, with the same module and the
 * same trust boundary as `tally verify`: verify/core.ts. From the bundle it
 * reads only the proof, R_disc and ṽ_disc; the round, its transfers and every
 * account key come from Soroban RPC.
 */
import React, { useCallback, useEffect, useState } from "react";
import { IconCircleCheck, IconCircleX, IconClockHour4, IconLoader2, IconAlertTriangle, IconPointFilled } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { REPO, repoFile, explorer, short, n } from "@/content/facts";

type Status = "pending" | "running" | "ok" | "fail" | "warn" | "skipped";
type Row = { id: string; label: string; status: Status; text?: string; notes: string[] };

const ROWS: Array<Pick<Row, "id" | "label">> = [
  { id: "round", label: "Round found" },
  { id: "transfers", label: "Transfers counted" },
  { id: "inputs", label: "Public inputs rebuilt" },
  { id: "vk", label: "Verification key matched" },
  { id: "proof", label: "Proof verified" },
  { id: "total", label: "Total" },
];
const fresh = (): Row[] => ROWS.map(r => ({ ...r, status: "pending", notes: [] }));

type Mode = "honest" | "altered" | "replayed";
type Outcome =
  | { kind: "verified"; total: string | null; transfers: number; lanes: number; window: string; ms: number }
  | { kind: "rejected"; ms: number }
  | { kind: "expired"; openedAt: number; oldest: number; days: string }
  | { kind: "error"; message: string };

interface Published {
  latest: { dir: string; published: string };
  round: { round_id: string; funder: string; registry: string; verifiable_until_ledger: number };
  challenge: any;
  bundle: any;
  deployment: any;
}

const DATA = "/verify-data";
const getJson = async (p: string) => {
  const r = await fetch(`${DATA}/${p}`);
  if (!r.ok) throw new Error(`could not load ${p} (${r.status})`);
  return r.json();
};

export function Verifier() {
  const [pub, setPub] = useState<Published | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(fresh);
  const [running, setRunning] = useState<Mode | null>(null);
  const [mode, setMode] = useState<Mode>("honest");
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const latest = await getJson("latest.json");
        const [round, challenge, bundle, deployment] = await Promise.all([
          getJson(`${latest.dir}/round.json`), getJson(`${latest.dir}/challenge.json`),
          getJson(`${latest.dir}/bundle.json`), getJson("deployment.json"),
        ]);
        setPub({ latest, round, challenge, bundle, deployment });
      } catch (e: any) { setLoadError(e?.message ?? String(e)); }
    })();
  }, []);

  const update = (id: string, patch: Partial<Row> | ((r: Row) => Partial<Row>)) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...(typeof patch === "function" ? patch(r) : patch) } : r)));

  const run = useCallback(async (m: Mode) => {
    if (!pub) return;
    setRunning(m); setMode(m); setOutcome(null); setRows(fresh());
    const t0 = performance.now();
    update("round", { status: "running" });
    try {
      const [core, bb, field, grumpkin] = await Promise.all([
        import("../../../verify/core"),
        import("@aztec/bb.js"),
        import("../../../ct/sdk/src/crypto/field"),
        import("../../../ct/sdk/src/crypto/grumpkin"),
      ]);

      // The two tampering cases change only what a funder could change.
      let challenge = pub.challenge;
      let bundle = pub.bundle;
      if (m === "altered") {
        bundle = { ...bundle, v_tilde_disc: core.hex(core.un0x(bundle.v_tilde_disc) + 1n) };
      } else if (m === "replayed") {
        const rR = field.randomScalar();
        const { x, y } = grumpkin.pointCoords(grumpkin.scalarMul(rR, grumpkin.H));
        challenge = { p_r_x: core.hex(x), p_r_y: core.hex(y), nu: core.hex(field.randomScalar()), secret_r_R: core.hex(rR) };
      }

      const order = ROWS.map(r => r.id);
      // A step's "ok" completes its row and starts the next; info and warnings attach to the row.
      const rowFor = (id: string) => (id === "retention" ? "round" : id === "circuit" ? "transfers" : id);

      const threads = typeof crossOriginIsolated !== "undefined" && crossOriginIsolated ? Math.min(navigator.hardwareConcurrency || 1, 8) : 1;
      const result = await core.verifyRound({
        deployment: pub.deployment,
        registry: pub.round.registry,
        funder: pub.round.funder,
        roundIdHex: pub.round.round_id,
        challenge, bundle,
        loadCircuit: async cap => {
          const [circuit, vk] = await Promise.all([
            getJson(`circuits/aggregate_n${cap}.json`),
            fetch(`${DATA}/circuits/aggregate_n${cap}.vk.zk.bin`).then(r => (r.ok ? r.arrayBuffer() : null)),
          ]);
          return { circuit, pinnedVk: vk ? new Uint8Array(vk) : null };
        },
        makeBackend: bytecode => new bb.UltraHonkBackend(bytecode, { threads }) as any,
        onStep: s => {
          const id = rowFor(s.id);
          if (s.kind === "ok") {
            update(id, { status: "ok", text: s.text });
            const next = order[order.indexOf(id) + 1];
            if (next) update(next, { status: "running" });
          } else {
            update(id, r => ({ notes: [...r.notes, s.text] }));
          }
        },
      });
      const ms = Math.round(performance.now() - t0);

      if (result.state === "expired") {
        setRows(rs => rs.map(r => (r.id === "round" ? { ...r, status: "warn" } : { ...r, status: "skipped" })));
        setOutcome({ kind: "expired", openedAt: result.round.opened_at, oldest: result.oldest, days: core.ledgersToDays(result.agedBy).toFixed(1) });
      } else if (result.state === "rejected") {
        setRows(rs => rs.map(r => (r.id === "proof" ? { ...r, status: "fail", text: "PROOF FAILED: the proof does not verify against the inputs rebuilt from chain" } : r.id === "total" ? { ...r, status: "skipped" } : r.status === "running" ? { ...r, status: "ok" } : r)));
        setOutcome({ kind: "rejected", ms });
      } else {
        const total = result.total === null ? null : result.total.toString();
        update("total", {
          status: "ok",
          text: total === null ? "sealed to the challenge's issuer" : `${n(Number(total))} stroops of the wrapped asset, over ${result.transfers} transfers from ${result.lanes} declared lanes`,
        });
        setOutcome({ kind: "verified", total, transfers: result.transfers, lanes: result.lanes, window: `${result.round.opened_at}–${result.round.closed_at}`, ms });
      }
    } catch (e: any) {
      const message = e?.message ?? String(e);
      setRows(rs => rs.map(r => (r.status === "running" ? { ...r, status: "fail", text: message } : r)));
      setOutcome({ kind: "error", message });
    } finally {
      setRunning(null);
    }
  }, [pub]);

  if (loadError) return <p className="font-inter text-sm text-red-700 dark:text-red-400">The published evidence could not be loaded: {loadError}</p>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl bg-neutral-50 p-6 dark:bg-neutral-800">
          <p className="font-inter text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400">The published round</p>
          {pub ? (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-inter text-sm">
              <dt className="text-neutral-600 dark:text-neutral-400">Round</dt><dd><a className="text-primary underline-offset-4 hover:underline" href={repoFile(`evidence/${pub.latest.dir}`)}>{pub.latest.dir}</a>, published {pub.latest.published}</dd>
              <dt className="text-neutral-600 dark:text-neutral-400">Funder</dt><dd><a className="break-all font-mono text-xs text-primary underline-offset-4 hover:underline" href={explorer("account", pub.round.funder)}>{short(pub.round.funder, 8, 6)}</a></dd>
              <dt className="text-neutral-600 dark:text-neutral-400">Round id</dt><dd className="break-all font-mono text-xs">{short(pub.round.round_id, 12, 6)}</dd>
              <dt className="text-neutral-600 dark:text-neutral-400">Registry</dt><dd><a className="font-mono text-xs text-primary underline-offset-4 hover:underline" href={explorer("contract", pub.round.registry)}>{short(pub.round.registry, 8, 6)}</a></dd>
              <dt className="text-neutral-600 dark:text-neutral-400">Verifiable until</dt><dd>ledger {n(pub.round.verifiable_until_ledger)}</dd>
            </dl>
          ) : (
            <p className="mt-3 h-[7.5rem] font-inter text-sm text-neutral-600 dark:text-neutral-400">Loading the published evidence…</p>
          )}
        </div>

        <div className="rounded-3xl border border-neutral-200 p-6 dark:border-neutral-800">
          <p className="font-inter text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400">Taken from the funder&apos;s bundle</p>
          <p className="mt-2 font-inter text-sm text-neutral-700 dark:text-neutral-300">Only these three values. The round, its window, its transfers and every account key are read from Soroban RPC.</p>
          <ul className="mt-3 space-y-1 font-mono text-xs text-neutral-700 dark:text-neutral-300">
            <li>π (proof) {pub ? `${Math.round((atob(pub.bundle.proof).length))} B` : ""}</li>
            <li className="break-all">R_disc {pub ? `(${short(pub.bundle.r_disc_x, 10, 4)}, ${short(pub.bundle.r_disc_y, 10, 4)})` : ""}</li>
            <li className="break-all">ṽ_disc {pub ? short(pub.bundle.v_tilde_disc, 10, 4) : ""}</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Button className="shadow-brand" disabled={!pub || !!running} onClick={() => run("honest")}>
            {running === "honest" ? "Verifying…" : "Verify this round"}
          </Button>
          <p className="font-inter text-xs text-neutral-600 dark:text-neutral-400">Try breaking it. Each button changes one thing a funder could change, then runs the same verification.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button variant="outline" disabled={!pub || !!running} onClick={() => run("altered")}>
              {running === "altered" ? "Verifying…" : "Alter the sealed total by one"}
            </Button>
            <Button variant="outline" disabled={!pub || !!running} onClick={() => run("replayed")}>
              {running === "replayed" ? "Verifying…" : "Replay against a new challenge"}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-neutral-50 p-6 dark:bg-neutral-800" aria-live="polite">
        <p className="font-inter text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          {mode === "honest" ? "Verification" : mode === "altered" ? "Verification: sealed total altered by one" : "Verification: bundle replayed against a new challenge"}
        </p>
        <ol className="mt-4 space-y-3">
          {rows.map(r => (
            <li key={r.id} className="flex gap-3">
              <StatusIcon status={r.status} />
              <div className="min-w-0">
                <p className={cn("font-inter text-sm font-medium", r.status === "pending" || r.status === "skipped" ? "text-neutral-600 dark:text-neutral-400" : "text-neutral-900 dark:text-neutral-100")}>{r.label}</p>
                {r.text && <p className={cn("break-words font-mono text-xs", r.status === "fail" ? "text-red-700 dark:text-red-400" : "text-neutral-700 dark:text-neutral-300")}>{r.text}</p>}
                {r.notes.map(t => <p key={t} className="break-words font-mono text-xs text-neutral-600 dark:text-neutral-400">{t}</p>)}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 min-h-[5.5rem]">
          {outcome?.kind === "verified" && (
            <div className="rounded-2xl bg-white p-4 dark:bg-neutral-900">
              <p className="font-inter text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400">Total, decrypted with the donor&apos;s own key</p>
              <p className="mt-1 font-display text-3xl font-bold text-primary">{outcome.total === null ? "sealed" : n(Number(outcome.total))}</p>
              <p className="font-inter text-xs text-neutral-600 dark:text-neutral-400">Over {outcome.transfers} transfers from {outcome.lanes} declared lanes, ledgers {outcome.window}. No individual amount was revealed. Checked in {(outcome.ms / 1000).toFixed(1)} s.</p>
            </div>
          )}
          {outcome?.kind === "rejected" && (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
              <p className="font-inter text-sm font-medium text-red-800 dark:text-red-300">Proof rejected, as it should be.</p>
              <p className="font-inter text-xs text-red-800 dark:text-red-300">
                {mode === "altered"
                  ? "The sealed total no longer matches what the proof commits to."
                  : "The proof was made for a different challenge, so it does not answer this one."}{" "}
                The command-line tool exits with code 2 here.
              </p>
            </div>
          )}
          {outcome?.kind === "expired" && (
            <div className="rounded-2xl border border-sealed/40 bg-sealed-dim p-4">
              <p className="font-inter text-sm font-medium text-neutral-900 dark:text-neutral-100">This round has aged out of the RPC&apos;s event window. This is not a failed proof.</p>
              <p className="mt-1 font-inter text-xs text-neutral-800 dark:text-neutral-200">
                The round opened at ledger {n(outcome.openedAt)}; the RPC now serves from ledger {n(outcome.oldest)}, about {`${outcome.days} days`} later. Verification lists the round&apos;s transfers from chain events on purpose, and those events are no longer served. A fresh round is published automatically before this happens; reload the page to pick it up.
              </p>
            </div>
          )}
          {outcome?.kind === "error" && (
            <p className="font-inter text-sm text-neutral-800 dark:text-neutral-200">Could not verify: {outcome.message}. This is not a proof result. The command-line tool exits with code 1 here.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  const c = "mt-0.5 size-5 shrink-0";
  if (status === "ok") return <IconCircleCheck className={cn(c, "text-primary")} aria-label="done" />;
  if (status === "fail") return <IconCircleX className={cn(c, "text-red-600 dark:text-red-400")} aria-label="failed" />;
  if (status === "warn") return <IconAlertTriangle className={cn(c, "text-sealed")} aria-label="warning" />;
  if (status === "running") return <IconLoader2 className={cn(c, "animate-spin text-neutral-600 motion-reduce:animate-none dark:text-neutral-400")} aria-label="running" />;
  if (status === "skipped") return <IconPointFilled className={cn(c, "text-neutral-300 dark:text-neutral-600")} aria-label="not reached" />;
  return <IconClockHour4 className={cn(c, "text-neutral-400 dark:text-neutral-500")} aria-label="waiting" />;
}

export const VERIFY_SOURCE = `${REPO}/blob/main/verify/core.ts`;
