import Link from "next/link";
import { Bell } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function NotificationBell({ notifications, unreadCount }: { notifications: any[]; unreadCount: number }) {
  return (
    <details className="group relative">
      <summary className="relative flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border bg-card shadow-sm hover:bg-muted [&::-webkit-details-marker]:hidden">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </summary>
      <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border bg-card shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b p-3">
          <div>
            <p className="font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
          </div>
          <form action={markAllNotificationsRead}>
            <Button size="sm" variant="ghost" className="h-8">Mark all read</Button>
          </form>
        </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length ? notifications.map((notification) => (
              <div key={notification._id.toString()} className={notification.readAt ? "border-b p-3" : "border-b bg-primary/5 p-3"}>
                <Link href={`/api/notifications/${notification._id}/open`} className="block hover:text-primary">
                  <p className="text-sm font-semibold">{notification.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{notification.message}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">{formatDate(notification.createdAt)}</p>
              </Link>
              {!notification.readAt && (
                <form action={markNotificationRead} className="mt-2">
                  <input type="hidden" name="id" value={notification._id.toString()} />
                  <Button size="sm" variant="outline" className="h-7 text-[11px]">Mark read</Button>
                </form>
              )}
            </div>
            )) : <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>}
          </div>
          <Link href="/notifications" className="block border-t p-3 text-center text-sm font-medium text-primary hover:bg-muted">
            View all notifications
          </Link>
        </div>
      </details>
  );
}
