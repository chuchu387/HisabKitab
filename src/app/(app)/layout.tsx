import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="flex h-screen overflow-hidden bg-background/80">
      <Sidebar role={session.user.role} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header name={session.user.name ?? ""} email={session.user.email ?? ""} role={session.user.role} />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
