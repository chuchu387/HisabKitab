import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="flex min-h-screen">
      <Sidebar role={session.user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header name={session.user.name ?? ""} email={session.user.email ?? ""} role={session.user.role} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
