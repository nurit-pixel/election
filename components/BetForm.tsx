"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BONUS, COPY } from "@/lib/copy";
import { PARTIES, PARTY_BY_KEY, PM_PARTIES, TOTAL_SEATS } from "@/lib/parties";
import type { Bet } from "@/lib/scoring";
import { betToDraft, draftToBet, emptyDraft, PM_OTHER_MAX, seatSum, type Draft } from "@/lib/validate";
import PartyCard from "./PartyCard";
import SeatSlider from "./SeatSlider";
import StickyCounter from "./StickyCounter";
import PmCard from "./PmCard";
import BonusToggle from "./BonusToggle";
import BallotDrop from "./BallotDrop";

type Props = { playerId: string; initialBet: Bet | null; locked: boolean };

const draftKey = (id: string) => `k43-draft-${id}`;

export default function BetForm({ playerId, initialBet, locked }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => (initialBet ? betToDraft(initialBet) : emptyDraft()));
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const dirty = useRef(false);

  // טיוטה מ-localStorage גוברת על ההימור השמור (היא נמחקת אחרי שליחה מוצלחת)
  useEffect(() => {
    if (!locked) {
      try {
        const raw = localStorage.getItem(draftKey(playerId));
        if (raw) setDraft({ ...emptyDraft(), ...JSON.parse(raw) });
      } catch {}
    }
    setLoaded(true);
  }, [playerId, locked]);

  useEffect(() => {
    if (!loaded || locked || !dirty.current) return;
    try {
      localStorage.setItem(draftKey(playerId), JSON.stringify(draft));
    } catch {}
  }, [draft, loaded, locked, playerId]);

  const update = (fn: (d: Draft) => Draft) => {
    dirty.current = true;
    setDraft(fn);
  };

  const sum = seatSum(draft.seats);
  const bet = useMemo(() => draftToBet(draft), [draft]);
  const missingBonus = BONUS.filter((b) => draft.bonus[b.key] === null || draft.bonus[b.key] === undefined).length;

  const problems: string[] = [];
  if (sum > TOTAL_SEATS) problems.push(COPY.sumOver(sum));
  if (sum < TOTAL_SEATS) problems.push(COPY.sumUnder(TOTAL_SEATS - sum));
  if (!draft.pm || (draft.pm === "other" && !draft.pmOther.trim())) problems.push(COPY.missingPm);
  if (!draft.bloc) problems.push(COPY.missingBloc);
  if (missingBonus) problems.push(COPY.missingBonus(missingBonus));

  async function submit() {
    setTried(true);
    if (!bet || locked) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bet),
      });
      if (res.status === 401) return router.replace("/");
      if (res.status === 403) {
        setError(COPY.locked);
        return router.refresh();
      }
      if (!res.ok) throw new Error();
      try {
        localStorage.removeItem(draftKey(playerId));
      } catch {}
      // אנימציית הקלפי, ואז לדף האישור (מיד למי שביקש פחות תנועה)
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) {
        setCelebrate(true);
        await new Promise((r) => setTimeout(r, 2100));
      }
      router.push("/done");
      router.refresh();
    } catch {
      setError(COPY.genericError);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      {celebrate && <BallotDrop letters={topLetters(draft.seats)} />}
      {locked && <p className="box border-accent/60 p-4 text-center font-display text-2xl glow-red">{COPY.locked}</p>}

      <section aria-labelledby="sec-seats">
        <h2 id="sec-seats" className="mb-2 text-4xl">
          {COPY.sectionSeats}
        </h2>
        <StickyCounter sum={sum} seats={draft.seats} />
        <div className="mt-2 space-y-3">
          {PARTIES.map((p) => (
            <PartyCard key={p.key} party={p}>
              <SeatSlider
                value={draft.seats[p.key] ?? 0}
                color={p.color}
                label={p.name}
                disabled={locked}
                onChange={(v) => update((d) => ({ ...d, seats: { ...d.seats, [p.key]: v } }))}
              />
            </PartyCard>
          ))}
        </div>
      </section>

      <section aria-labelledby="sec-pm">
        <h2 id="sec-pm" className="mb-3 text-4xl">
          {COPY.sectionPm}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {PM_PARTIES.map((p) => (
            <PmCard
              key={p.key}
              partyKey={p.key}
              color={p.color}
              title={p.leader || p.name}
              subtitle={p.leader ? p.name : undefined}
              selected={draft.pm === p.key}
              disabled={locked}
              onSelect={() => update((d) => ({ ...d, pm: p.key }))}
            />
          ))}
          <PmCard
            title={COPY.pmOther}
            selected={draft.pm === "other"}
            disabled={locked}
            onSelect={() => update((d) => ({ ...d, pm: "other" }))}
          >
            {draft.pm === "other" && (
              <input
                className="input mt-1 text-center"
                value={draft.pmOther}
                maxLength={PM_OTHER_MAX}
                placeholder={COPY.pmOtherPlaceholder}
                disabled={locked}
                autoFocus={!locked && !draft.pmOther}
                onChange={(e) => update((d) => ({ ...d, pmOther: e.target.value }))}
              />
            )}
          </PmCard>
          <PmCard
            title={COPY.pmNone}
            selected={draft.pm === "none"}
            disabled={locked}
            onSelect={() => update((d) => ({ ...d, pm: "none" }))}
          />
        </div>
      </section>

      <section aria-labelledby="sec-bloc">
        <h2 id="sec-bloc" className="mb-1 text-4xl">
          {COPY.sectionBloc}
        </h2>
        <p className="mb-3 text-muted">{COPY.sectionBlocHint}</p>
        <div className="grid grid-cols-2 gap-3">
          {(["coalition", "opposition"] as const).map((b) => (
            <button
              key={b}
              type="button"
              className={`btn min-h-20 text-2xl ${draft.bloc === b ? "btn-ink" : ""}`}
              aria-pressed={draft.bloc === b}
              disabled={locked}
              onClick={() => update((d) => ({ ...d, bloc: b }))}
            >
              {b === "coalition" ? COPY.blocCoalition : COPY.blocOpposition}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="sec-bonus">
        <h2 id="sec-bonus" className="mb-3 text-4xl">
          {COPY.sectionBonus}
        </h2>
        <div className="space-y-3">
          {BONUS.map((b) => (
            <BonusToggle
              key={b.key}
              text={b.text}
              value={draft.bonus[b.key] ?? null}
              disabled={locked}
              onChange={(v) => update((d) => ({ ...d, bonus: { ...d.bonus, [b.key]: v } }))}
            />
          ))}
        </div>
      </section>

      {!locked && (
        <div className="space-y-3">
          {tried && problems.length > 0 && (
            <ul className="box space-y-1 border-accent/60 p-3 text-accent" role="alert">
              {problems.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          )}
          {error && (
            <p className="font-semibold text-accent" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary w-full text-2xl"
            style={{ minHeight: 64 }}
            onClick={submit}
            disabled={sending || (tried && !bet)}
          >
            {sending ? COPY.saving : COPY.submit}
          </button>
        </div>
      )}
    </div>
  );
}

// אות הפתק של המפלגה הגדולה בהימור — מופיעה על הפתק באנימציה
function topLetters(seats: Record<string, number>) {
  const top = Object.entries(seats).sort((a, b) => b[1] - a[1])[0];
  return (top && PARTY_BY_KEY[top[0]]?.letters) || "43";
}
