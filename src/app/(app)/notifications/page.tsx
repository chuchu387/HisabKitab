import Link from "next/link";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { Notification } from "@/models/Notification";

export default async function NotificationsPage({ searchParams }: any) {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const notifications = await Notification.find({ organizationId, userId: session.user.userId }).sort({ createdAt: -1 }).lean();

  return (
    <PageShell title="Notifications" description="System alerts, assignments, approvals, and payment updates.">
      <DataTable
        data={notifications}
        pagination={{ basePath: "/notifications", searchParams: params }}
        columns={[
          { header: "Notification", cell: (notification: any) => (
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <Link href={`/api/notifications/${notification._id}/open`} className="font-semibold hover:text-primary">{notification.title}</Link>
                <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
              </div>
            </div>
          ) },
          { header: "Type", cell: (notification: any) => <Badge variant="info">{notification.type}</Badge> },
          { header: "Status", cell: (notification: any) => notification.readAt ? <Badge variant="muted">Read</Badge> : <Badge variant="success">Unread</Badge> },
          { header: "Date", cell: (notification: any) => formatDate(notification.createdAt) },
          { header: "Actions", cell: (notification: any) => <Button asChild size="sm" variant="outline"><Link href={`/api/notifications/${notification._id}/open`}>Open</Link></Button> }
        ]}
      />
    </PageShell>
  );
}
