import Link from "next/link";
import Logo from "./Logo";

export default function TopBar({ links = [] }: { links?: { href: string; label: string }[] }) {
  return (
    <nav className="mb-6 flex items-center justify-between gap-3 border-b-[3px] border-black pb-3">
      <Logo />
      <div className="flex gap-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-12 items-center font-semibold underline underline-offset-4">
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
