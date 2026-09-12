import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/?auth=login");
  }
  return (
    <DashboardShell user={{ username: session.username, avatar: session.avatar }}>
      {children}
    </DashboardShell>
  );
}
