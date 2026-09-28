import Link from "next/link";
import { COPY } from "@/lib/copy";

export default function Logo({ big = false }: { big?: boolean }) {
  if (!big)
    return (
      <Link href="/" className="block font-display text-2xl leading-none text-ink no-underline">
        מטה המאבק <span className="text-accent">כוח 43</span>
      </Link>
    );
  return (
    <header className="pt-4 text-center">
      <h1 className="text-[56px] leading-[0.95] sm:text-[80px]">
        מטה המאבק
        <br />
        <span className="inline-block -rotate-2 border-[3px] border-black bg-accent px-3 text-white shadow-[4px_4px_0_#000]">
          כוח 43
        </span>
      </h1>
      <p className="mt-4 text-lg opacity-80">{COPY.subtitle}</p>
    </header>
  );
}
