"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GroupQuestion } from "@/lib/groupScore";
import { MAX_GROUP_QUESTIONS } from "@/lib/groupScore";

type Member = { id: string; name: string; joined_at: string };

export function MembersManager({ slug, ownerId, initial }: { slug: string; ownerId: string | null; initial: Member[] }) {
  const router = useRouter();
  const [members, setMembers] = useState(initial);
  return (
    <ul className="space-y-2">
      {members.map((m) => (
        <li key={m.id} className="box flex items-center gap-2 p-2.5">
          <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
          {m.id === ownerId ? (
            <span className="chip px-2 py-0 text-xs text-cyan">מנהל/ת</span>
          ) : (
            <button
              type="button"
              className="btn min-h-10 border-accent/50 px-3 text-sm text-accent"
              onClick={async () => {
                if (!confirm(`להסיר את ${m.name} מהקבוצה? ההימור שלו/ה נשאר.`)) return;
                const res = await fetch(`/api/groups/${slug}/members`, {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ playerId: m.id }),
                });
                if (res.ok) {
                  setMembers((x) => x.filter((y) => y.id !== m.id));
                  router.refresh();
                }
              }}
            >
              הסרה
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function QuestionsManager({ slug, initial, locked }: { slug: string; initial: GroupQuestion[]; locked: boolean }) {
  const router = useRouter();
  const [texts, setTexts] = useState<string[]>(initial.length ? initial.map((q) => q.text) : []);
  const [questions, setQuestions] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveTexts() {
    setMsg(null);
    const res = await fetch(`/api/groups/${slug}/questions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: texts }),
    });
    if (!res.ok) return setMsg(res.status === 403 ? "אחרי הנעילה אי אפשר לשנות שאלות." : "משהו השתבש.");
    const d = await res.json();
    setQuestions(d.questions);
    setTexts(d.questions.map((q: GroupQuestion) => q.text));
    setMsg("נשמר ✓");
    router.refresh();
  }

  async function setAnswer(id: string, answer: boolean | null) {
    const res = await fetch(`/api/groups/${slug}/questions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: { [id]: answer } }),
    });
    if (res.ok) {
      setQuestions((await res.json()).questions);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted">
          עד {MAX_GROUP_QUESTIONS} שאלות כן/לא משלכם (למשל &quot;מישהו מהקבוצה יירדם לפני המדגם?&quot;). אם מגדירים שאלות — הן מחליפות בקבוצה את
          שאלות הבונוס הכלליות. בלי שאלות — משתמשים בכלליות.
        </p>
        {texts.map((t, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input flex-1"
              value={t}
              maxLength={140}
              disabled={locked}
              placeholder={`שאלה ${i + 1}`}
              onChange={(e) => setTexts((x) => x.map((y, j) => (j === i ? e.target.value : y)))}
            />
            {!locked && (
              <button type="button" className="btn px-3" aria-label="מחיקת שאלה" onClick={() => setTexts((x) => x.filter((_, j) => j !== i))}>
                ✕
              </button>
            )}
          </div>
        ))}
        {!locked && (
          <div className="flex gap-2">
            {texts.length < MAX_GROUP_QUESTIONS && (
              <button type="button" className="btn flex-1 text-base" onClick={() => setTexts((x) => [...x, ""])}>
                + שאלה
              </button>
            )}
            <button type="button" className="btn btn-ink flex-1 text-base" onClick={saveTexts}>
              שמירת השאלות
            </button>
          </div>
        )}
        {msg && <p className={msg.includes("✓") ? "text-ok" : "text-accent"}>{msg}</p>}
      </div>

      {questions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xl">התשובות הנכונות</h3>
          <p className="text-sm text-muted">מזינים כשהתשובה ידועה (בדרך כלל בליל הבחירות). הניקוד בקבוצה מתעדכן מיד.</p>
          {questions.map((q) => (
            <div key={q.id} className="box p-3">
              <p className="mb-2 font-semibold">{q.text}</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    [true, "כן"],
                    [false, "לא"],
                    [null, "עוד לא ידוע"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={String(v)}
                    type="button"
                    className={`btn min-h-10 text-sm ${q.answer === v ? "btn-ink" : ""}`}
                    onClick={() => setAnswer(q.id, v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DeleteGroup({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn w-full border-accent/50 text-accent"
      onClick={async () => {
        if (!confirm(`למחוק את "${name}"? הדירוג והשאלות של הקבוצה יימחקו. ההימורים של החברים נשארים.`)) return;
        const res = await fetch(`/api/groups/${slug}`, { method: "DELETE" });
        if (res.ok) {
          router.push("/me");
          router.refresh();
        }
      }}
    >
      🗑 מחיקת הקבוצה
    </button>
  );
}
