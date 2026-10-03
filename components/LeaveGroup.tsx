"use client";

import { useRouter } from "next/navigation";

export default function LeaveGroup({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm text-muted underline underline-offset-4"
      onClick={async () => {
        if (!confirm(`לעזוב את "${name}"? ההימור שלך נשאר, ותוכלו לחזור עם הקישור.`)) return;
        await fetch(`/api/groups/${slug}/leave`, { method: "POST" });
        router.push("/me");
        router.refresh();
      }}
    >
      עזיבת הקבוצה
    </button>
  );
}
