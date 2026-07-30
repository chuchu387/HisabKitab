import { Types } from "mongoose";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { ChatGroup } from "@/models/ChatGroup";
import { ChatMessage } from "@/models/ChatMessage";
import { User } from "@/models/User";
import { ChatShell } from "./chat-shell";

export default async function ChatPage({ searchParams }: any) {
  const { session, organizationId } = await requireTenant();
  await connectToDatabase();
  const oid = new Types.ObjectId(organizationId);
  const userId = session.user.userId;

  const groups = await ChatGroup.find({ organizationId: oid, "members.userId": userId })
    .sort({ updatedAt: -1 })
    .populate("members.userId", "name email")
    .lean() as any[];

  const params = await searchParams;
  const activeGroupId = typeof params?.g === "string" ? params.g : null;
  const showCreate = params?.newGroup === "";

  let activeGroup: any = null;
  let messages: any[] = [];
  if (activeGroupId) {
    activeGroup = groups.find((g: any) => g._id.toString() === activeGroupId);
    if (activeGroup) {
      messages = await ChatMessage.find({ organizationId: oid, groupId: activeGroupId })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate("senderId", "name email")
        .lean() as any[];
      messages.reverse();
    }
  }

  const staff = await User.find({ organizationId: oid, active: true }).select("name email").lean() as any[];
  const currentUser = staff.find((u: any) => u._id.toString() === userId);

  return (
    <PageShell title="Chat" description="Team group chats" hideTitle>
      <ChatShell
        groups={JSON.parse(JSON.stringify(groups))}
        messages={JSON.parse(JSON.stringify(messages))}
        activeGroupId={activeGroupId}
        showCreate={showCreate}
        currentUser={JSON.parse(JSON.stringify({ ...currentUser, userId }))}
        staff={JSON.parse(JSON.stringify(staff))}
        isAdmin={["owner", "admin"].includes(session.user.role)}
      />
    </PageShell>
  );
}
