import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guards";
import { isStageRole } from "@/lib/workflow";

export default async function Home() {
  const user = await requireSession();
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role === "SCOUT") redirect("/entries");
  if (isStageRole(user.role)) redirect("/queue");
  redirect("/account");
}
