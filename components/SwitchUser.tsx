"use client";

import { useRouter } from "next/navigation";
import { COPY } from "@/lib/copy";

export default function SwitchUser({ name }: { name: string }) {
  const router = useRouter();
  return (
    <p className="text-sm text-muted">
      {COPY.notYou(name)}{" "}
      <button
        type="button"
        className="inline-flex min-h-10 items-center text-cyan underline underline-offset-4"
        onClick={async () => {
          await fetch("/api/logout", { method: "POST" });
          router.replace("/");
          router.refresh();
        }}
      >
        {COPY.switchUser}
      </button>
    </p>
  );
}
