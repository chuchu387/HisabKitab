import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { connectToDatabase } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { Notification } from "@/models/Notification";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  await connectToDatabase();
  const [notifications, unreadCount] = session.user.organizationId ? await Promise.all([
    Notification.find({ organizationId: session.user.organizationId, userId: session.user.userId }).sort({ createdAt: -1 }).limit(10).lean(),
    Notification.countDocuments({ organizationId: session.user.organizationId, userId: session.user.userId, readAt: null })
  ]) : [[], 0];
  return (
    <div className="flex h-dvh overflow-hidden bg-background/80">
      <Sidebar role={session.user.role} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header name={session.user.name ?? ""} email={session.user.email ?? ""} role={session.user.role} notifications={JSON.parse(JSON.stringify(notifications))} unreadCount={unreadCount} />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
