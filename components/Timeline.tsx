import { COPY } from "@/lib/copy";

const TZ = "Asia/Jerusalem";

export default function Timeline({ lockAt }: { lockAt: string }) {
  const d = new Date(lockAt);
  const date = d.toLocaleDateString("he-IL", { timeZone: TZ, day: "numeric", month: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const steps = COPY.timeline(date, time);
  return (
    <section className="box p-5" aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="mb-4 text-2xl">
        {COPY.timelineTitle}
      </h2>
      <ol className="relative space-y-5 ps-1">
        <span className="absolute inset-y-3 start-[17px] w-px bg-gradient-to-b from-cyan via-accent to-transparent" aria-hidden />
        {steps.map((step, i) => (
          <li key={i} className="relative flex gap-4">
            <span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan bg-bg font-display text-cyan shadow-[0_0_14px_rgb(34_211_238/0.45)]">
              {i + 1}
            </span>
            <div>
              <div className="font-semibold leading-snug">{step.when}</div>
              <div className="text-base leading-snug text-muted">{step.what}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
