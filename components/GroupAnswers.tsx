"use client";

import { useState } from "react";
import type { GroupQuestion } from "@/lib/groupScore";
import BonusToggle from "./BonusToggle";

// תשובות החבר/ה לשאלות הבונוס של הקבוצה. אחרי הנעילה — לקריאה בלבד, עם התשובה הנכונה כשידועה.
export default function GroupAnswers({
  slug,
  questions,
  initial,
  locked,
}: {
  slug: string;
  questions: GroupQuestion[];
  initial: Record<string, boolean>;
  locked: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, initial[q.id] ?? null])),
  );
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const missing = questions.filter((q) => answers[q.id] === null).length;

  async function save(next: Record<string, boolean | null>) {
    setState("saving");
    const body = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== null));
    const res = await fetch(`/api/groups/${slug}/answers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: body }),
    });
    setState(res.ok ? "saved" : "error");
  }

  return (
    <div className="space-y-3">
      {questions.map((q) =>
        locked ? (
          <div key={q.id} className="box p-3">
            <p className="font-semibold">{q.text}</p>
            <p className="text-sm text-muted">
              התשובה שלך: <b className="text-fg">{answers[q.id] === null ? "—" : answers[q.id] ? "כן" : "לא"}</b>
              {q.answer !== null && (
                <>
                  {" · "}נכון: <b className={answers[q.id] === q.answer ? "text-ok" : "text-accent"}>{q.answer ? "כן" : "לא"}</b>
                </>
              )}
            </p>
          </div>
        ) : (
          <BonusToggle
            key={q.id}
            text={q.text}
            value={answers[q.id]}
            onChange={(v) => {
              const next = { ...answers, [q.id]: v };
              setAnswers(next);
              save(next); // נשמר מיד בכל לחיצה
            }}
          />
        ),
      )}
      {!locked && (
        <p className="text-sm" role="status">
          {state === "saving" ? (
            <span className="text-muted">שומר…</span>
          ) : state === "error" ? (
            <span className="text-accent">לא נשמר. נסו שוב.</span>
          ) : missing ? (
            <span className="text-accent">נשארו {missing} שאלות בלי תשובה.</span>
          ) : (
            <span className="text-ok">כל התשובות נשמרו ✓</span>
          )}
        </p>
      )}
    </div>
  );
}
