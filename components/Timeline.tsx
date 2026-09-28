import { COPY } from "@/lib/copy";

const TZ = "Asia/Jerusalem";

export default function Timeline({ lockAt }: { lockAt: string }) {
  const d = new Date(lockAt);
  const date = d.toLocaleDateString("he-IL", { timeZone: TZ, day: "numeric", month: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  return (
    <section className="box p-4" aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="mb-3 text-2xl">
        {COPY.timelineTitle}
      </h2>
      <ol className="space-y-3">
        {COPY.timeline(date, time).map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black font-display">
              {i + 1}
            </span>
            <div>
              <div className="font-semibold leading-snug">{step.when}</div>
              <div className="text-base leading-snug opacity-80">{step.what}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
