import { redirect } from "next/navigation";
import { getPlayerId } from "@/lib/auth";
import GroupForm from "@/components/GroupForm";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function NewGroupPage() {
  if (!(await getPlayerId())) redirect("/?next=/groups/new");
  return (
    <>
      <TopBar />
      <h1 className="mb-2 text-5xl">קבוצה חדשה</h1>
      <p className="mb-6 text-muted">אחרי היצירה תקבלו קישור הזמנה לשלוח בוואטסאפ.</p>
      <GroupForm />
    </>
  );
}
