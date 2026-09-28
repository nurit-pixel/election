import Link from "next/link";
import { COPY } from "@/lib/copy";

export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`chip border-accent/50 font-display text-sm tracking-wide ${className}`}>
      <span className="live-dot" />
      <span className="text-accent">{COPY.live}</span>
      <span className="text-muted">· {COPY.liveSub}</span>
    </span>
  );
}

export default function Logo({ big = false }: { big?: boolean }) {
  if (!big)
    return (
      <Link href="/" className="flex items-center gap-2 font-display text-2xl leading-none text-fg no-underline">
        <span className="live-dot" />
        מטה המאבק <span className="glow-red">כוח 43</span>
      </Link>
    );
  return (
    <header className="pt-2 text-center">
      <LiveBadge />
      <h1 className="mt-5 text-[58px] leading-[0.95] sm:text-[84px]">
        מטה המאבק
        <br />
        <span className="mt-2 inline-block rounded-xl border border-accent/60 bg-accent/10 px-4 pb-1 glow-red shadow-[0_0_40px_rgb(255_45_85/0.35),inset_0_0_24px_rgb(255_45_85/0.2)]">
          כוח 43
        </span>
      </h1>
      <p className="mt-4 text-lg text-muted">{COPY.subtitle}</p>
    </header>
  );
}
