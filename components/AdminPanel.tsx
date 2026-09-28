"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BONUS, COPY } from "@/lib/copy";
import { PARTIES, PM_PARTIES } from "@/lib/parties";
import { seatSum } from "@/lib/validate";
import type { Bloc } from "@/lib/scoring";
import type { Mode, ResultsRow } from "@/lib/data";
import PartyCard from "./PartyCard";
import SeatSlider from "./SeatSlider";
import StickyCounter from "./StickyCounter";

type Props = { results: ResultsRow; locked: boolean; lockAt: string };

export default function AdminPanel({ results, locked, lockAt }: Props) {
  const router = useRouter();
  const [seats, setSeats] = useState<Record<string, number>>(() =>
    Object.fromEntries(PARTIES.map((p) => [p.key, results.seats?.[p.key] ?? 0])),
  );
  const initialPm = results.pm ?? "";
  const [pm, setPm] = useState(initialPm.startsWith("other:") ? "other" : initialPm);
  const [pmOther, setPmOther] = useState(initialPm.startsWith("other:") ? initialPm.slice(6) : "");
  const [bloc, setBloc] = useState<Bloc | null>(results.bloc);
  const [bonus, setBonus] = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(BONUS.map((b) => [b.key, results.bonus?.[b.key] ?? null])),
  );
  const [mode, setMode] = useState<Mode>(results.mode);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(url: string, body?: unknown) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? res.status);
      return data;
    } catch (e) {
      setMsg(`${COPY.genericError} (${(e as Error).message})`);
      return null;
    } finally {
      setBusy(false);
    }
  }

  const save = async () => {
    const payload = {
      seats,
      pm: pm === "other" ? (pmOther.trim() ? `other:${pmOther.trim()}` : null) : pm || null,
      bloc,
      bonus,
      mode,
    };
    const d = await call("/api/results", payload);
    if (d) {
      setMsg(COPY.admin.saved(d.count));
      router.refresh();
    }
  };
  const lock = async (action: "lock" | "open" | "auto") => {
    if (await call("/api/lock", { action })) router.refresh();
  };

  const chip = (active: boolean) => `btn flex-1 text-base ${active ? "btn-ink" : ""}`;

  return (
    <div className="space-y-8">
      <section className="box space-y-3 p-3">
        <p className="font-semibold">
          {COPY.admin.lockStatus(locked, new Date(lockAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }))}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary flex-1" disabled={busy} onClick={() => lock("lock")}>
            {COPY.admin.lock}
          </button>
          <button className="btn flex-1" disabled={busy} onClick={() => lock("open")}>
            {COPY.admin.unlock}
          </button>
          <button className="btn flex-1 text-base" disabled={busy} onClick={() => lock("auto")}>
            {COPY.admin.autoLock}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-3xl">{COPY.admin.mode}</h2>
        <div className="flex gap-2">
          {(
            [
              ["none", COPY.admin.modeNone],
              ["exit_poll", COPY.admin.modeExit],
              ["official", COPY.admin.modeOfficial],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" className={chip(mode === m)} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-3xl">{COPY.sectionSeats}</h2>
        <StickyCounter sum={seatSum(seats)} />
        <div className="mt-2 space-y-3">
          {PARTIES.map((p) => (
            <PartyCard key={p.key} party={p}>
              <SeatSlider
                value={seats[p.key]}
                color={p.color}
                label={p.name}
                onChange={(v) => setSeats((s) => ({ ...s, [p.key]: v }))}
              />
            </PartyCard>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-3xl">{COPY.sectionPm}</h2>
        <div className="grid grid-cols-2 gap-2">
          {PM_PARTIES.map((p) => (
            <button key={p.key} type="button" className={chip(pm === p.key)} onClick={() => setPm(p.key)}>
              {p.leader || p.name}
            </button>
          ))}
          <button type="button" className={chip(pm === "other")} onClick={() => setPm("other")}>
            מישהו אחר
          </button>
          <button type="button" className={chip(pm === "none")} onClick={() => setPm("none")}>
            אין ממשלה
          </button>
          <button type="button" className={`${chip(pm === "")} col-span-2`} onClick={() => setPm("")}>
            {COPY.admin.bonusUnknown}
          </button>
        </div>
        {pm === "other" && (
          <input
            className="input mt-2"
            value={pmOther}
            onChange={(e) => setPmOther(e.target.value)}
            placeholder={COPY.pmOtherPlaceholder}
          />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-3xl">{COPY.sectionBloc}</h2>
        <div className="flex gap-2">
          <button type="button" className={chip(bloc === "coalition")} onClick={() => setBloc("coalition")}>
            {COPY.blocCoalition}
          </button>
          <button type="button" className={chip(bloc === "opposition")} onClick={() => setBloc("opposition")}>
            {COPY.blocOpposition}
          </button>
          <button type="button" className={chip(bloc === null)} onClick={() => setBloc(null)}>
            {COPY.admin.bonusUnknown}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-3xl">{COPY.sectionBonus}</h2>
        <div className="space-y-3">
          {BONUS.map((b) => (
            <div key={b.key} className="box p-3">
              <p className="mb-2 font-semibold">{b.text}</p>
              <div className="flex gap-2">
                {(
                  [
                    [true, COPY.yes],
                    [false, COPY.no],
                    [null, COPY.admin.bonusUnknown],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={String(v)}
                    type="button"
                    className={chip(bonus[b.key] === v)}
                    onClick={() => setBonus((x) => ({ ...x, [b.key]: v }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sticky bottom-10 z-30 -mx-4 space-y-2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
        {msg && <p className="font-semibold" role="status">{msg}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-primary text-base" disabled={busy} onClick={save}>
            {COPY.admin.save}
          </button>
          <a className="btn text-base" href="/api/export">
            {COPY.admin.exportCsv}
          </a>
        </div>
      </section>
    </div>
  );
}
