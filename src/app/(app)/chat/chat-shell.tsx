"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Send, Smile, Paperclip, Phone, Video, Reply, X, Trash2, ChevronLeft, Loader2, FileText, Download, UserPlus, AtSign, LogOut, MessageSquarePlus } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGroup, sendMessage, toggleReaction, deleteMessage, leaveGroup, addMembers, markRead, openConversation } from "@/actions/chat";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { useCalls } from "@/components/call-provider";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉", "💯", "⭐", "👏", "✅", "🤔", "👀", "🚀", "💪", "✨", "🎯", "🙌", "💡"];

function Avatar({ name, className }: { name: string; className?: string }) {
  const colors = ["bg-primary/20 text-primary", "bg-accent/20 text-accent", "bg-blue-500/20 text-blue-600", "bg-purple-500/20 text-purple-600", "bg-pink-500/20 text-pink-600", "bg-orange-500/20 text-orange-600"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", color, className)}>{name.charAt(0).toUpperCase()}</div>;
}

export function ChatShell({ groups, messages: initialMessages, activeGroupId, showCreate, currentUser, staff, isAdmin }: any) {
  const router = useRouter();
  const [activeGroup, setActiveGroup] = useState(activeGroupId);
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(showCreate);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [reactingToMsg, setReactingToMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const [liveGroups, setLiveGroups] = useState<any[]>(groups);
  const { chatGroups: liveChatGroups } = useRealtime({ unreadCount: 0, notifications: [], chatGroups: [] });
  const { startCall, busy, joinableCalls, joinCall } = useCalls();
  const [callPicker, setCallPicker] = useState<null | "audio" | "video">(null);

  const activeGroupCall = joinableCalls.find((c: any) => c.groupId === activeGroup);

  useEffect(() => {
    if (!liveChatGroups.length) return;
    setLiveGroups((prev) => {
      const map = new Map(prev.map((g: any) => [g._id, g]));
      for (const g of liveChatGroups) {
        const existing = map.get(g._id);
        map.set(g._id, {
          ...(existing ?? { _id: g._id, name: g.name, description: g.description, members: [], isDM: false }),
          isDM: g.isDM ?? existing?.isDM ?? false,
          memberCount: g.memberCount,
          updatedAt: g.updatedAt,
          lastMessage: g.lastMessage
        });
      }
      return Array.from(map.values()).sort((a, b) => (String(b.updatedAt || "") > String(a.updatedAt || "") ? 1 : -1));
    });
  }, [liveChatGroups]);

  const scrollToBottom = () => messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  const activeGroupData = groups.find((g: any) => g._id === activeGroup);

  const filteredStaff = useMemo(() => {
    if (!activeGroupData || !activeGroup) return staff;
    const memberIds = activeGroupData.members.map((m: any) => m.userId?._id || m.userId);
    return staff.filter((u: any) => !memberIds.includes(u._id));
  }, [activeGroupData, staff, activeGroup]);

  const pollMessages = useCallback(async () => {
    if (!activeGroup) return;
    try {
      const res = await fetch(`/chat/api?g=${activeGroup}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {}
  }, [activeGroup]);

  useEffect(() => {
    pollRef.current = setInterval(pollMessages, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollMessages]);

  useEffect(() => {
    if (activeGroup) { markRead(activeGroup); setShowSidebar(false); }
    setReplyTo(null);
    setSelectedFiles([]);
    setShowEmoji(false);
    setReactingToMsg(null);
  }, [activeGroup]);

  function navigate(gid: string | null) {
    const url = gid ? `/chat?g=${gid}` : "/chat";
    setActiveGroup(gid);
    setMessages([]);
    router.push(url);
  }

  // Mentions handling
  function handleTextChange(value: string) {
    setComposerText(value);
    const cursor = textRef.current?.selectionStart || value.length;
    const before = value.slice(0, cursor);
    const atMatch = before.match(/@(\w*)$/);
    if (atMatch) {
      setMentionOpen(true);
      setMentionQuery(atMatch[1].toLowerCase());
      setMentionIndex(-1);
    } else {
      setMentionOpen(false);
    }
  }

  function insertMention(user: any) {
    const textarea = textRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart;
    const before = composerText.slice(0, cursor);
    const after = composerText.slice(cursor);
    const atIdx = before.lastIndexOf("@");
    const newText = before.slice(0, atIdx) + `@${user.name} ` + after;
    setMentionOpen(false);
    setComposerText(newText);
    textarea.focus();
    const newPos = atIdx + user.name.length + 2;
    setTimeout(() => textarea.setSelectionRange(newPos, newPos), 0);
  }

  const mentionMatches = mentionOpen ? staff.filter((u: any) => u.name.toLowerCase().includes(mentionQuery) && u._id !== currentUser.userId) : [];

  async function handleSend() {
    if (!composerText.trim() && !selectedFiles.length) return;
    if (!activeGroup) return;
    setSending(true);
    const fd = new FormData();
    fd.set("groupId", activeGroup);
    fd.set("content", composerText.trim());
    if (replyTo) fd.set("replyTo", replyTo._id);
    const mentionedUsers = staff.filter((u: any) => composerText.includes(`@${u.name}`));
    if (mentionedUsers.length) fd.set("mentions", mentionedUsers.map((u: any) => u._id).join(","));
    selectedFiles.forEach((f) => fd.append("files", f));
    const res = await sendMessage(fd);
    setSending(false);
    if (!res.ok) { toast.error(res.message || "Failed to send"); return; }
    setComposerText("");
    setReplyTo(null);
    setSelectedFiles([]);
    setShowEmoji(false);
    pollMessages();
  }

  async function handleKeyDown(e: React.KeyboardEvent) {
    if (mentionOpen && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, mentionMatches.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" && mentionIndex >= 0) { e.preventDefault(); insertMention(mentionMatches[mentionIndex]); return; }
      if (e.key === "Escape") { setMentionOpen(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function addEmoji(emoji: string) {
    const textarea = textRef.current;
    if (textarea) {
      const cursor = textarea.selectionStart;
      const newText = composerText.slice(0, cursor) + emoji + composerText.slice(cursor);
      setComposerText(newText);
      setTimeout(() => textarea.setSelectionRange(cursor + emoji.length, cursor + emoji.length), 0);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => f.size <= 10 * 1024 * 1024);
    if (valid.length !== files.length) toast.error("Some files exceed 10MB and were skipped");
    setSelectedFiles((prev) => [...prev, ...valid]);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function isImage(mime: string) { return mime.startsWith("image/"); }
  function isOwnerOrAdmin(role: string) { return ["owner", "admin"].includes(role); }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await createGroup(fd);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(res.message);
    setShowCreateForm(false);
    router.refresh();
  }

  return (
    <div className="fixed inset-x-0 lg:left-64 top-14 sm:top-16 bottom-0 flex gap-4 overflow-hidden bg-background p-3 sm:p-4 lg:p-6">
      {/* Groups Sidebar */}
      <Card className={cn("flex w-72 shrink-0 flex-col overflow-hidden transition-all", showSidebar ? "max-md:flex" : "max-md:hidden max-md:w-0 max-md:overflow-hidden")}>
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="text-sm font-semibold">Chat</h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2" title="New private chat" onClick={() => setShowNewChat(!showNewChat)}><MessageSquarePlus className="h-4 w-4" /></Button>
            {isAdmin && <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowCreateForm(true)}><Plus className="h-4 w-4" /></Button>}
          </div>
        </div>
        {showNewChat && (
          <div className="border-b p-2">
            <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">Start a private chat with</p>
            <div className="max-h-40 overflow-y-auto rounded-lg border p-1.5">
              {staff.filter((u: any) => u._id !== currentUser?.userId).map((u: any) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={async () => {
                    const res = await openConversation(u._id);
                    if (!res.ok || !res.data) { toast.error(res.message || "Could not start chat"); return; }
                    setShowNewChat(false);
                    navigate(res.data.groupId);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-secondary/40"
                >
                  <Avatar name={u.name} className="h-6 w-6 text-[10px]" />
                  <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                </button>
              ))}
              {staff.filter((u: any) => u._id !== currentUser?.userId).length === 0 && <p className="p-2 text-[10px] text-muted-foreground">No other staff yet</p>}
            </div>
          </div>
        )}
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {liveGroups.filter((g: any) => g.isDM).length > 0 && (
            <>
              <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Direct messages</p>
              {liveGroups.filter((g: any) => g.isDM).map((g: any) => {
                const isActive = g._id === activeGroup;
                return (
                  <button key={g._id} onClick={() => navigate(g._id)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary/60", isActive && "bg-primary/10 text-primary font-medium")}>
                    <Avatar name={g.name} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-xs font-medium", isActive && "text-primary")}>{g.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{g.lastMessage?.content || "Private chat"}</p>
                    </div>
                  </button>
                );
              })}
            </>
          )}
          {liveGroups.filter((g: any) => !g.isDM).length > 0 && (
            <>
              <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Groups</p>
              {liveGroups.filter((g: any) => !g.isDM).map((g: any) => {
                const isActive = g._id === activeGroup;
                const unread = 0;
                return (
                  <button key={g._id} onClick={() => navigate(g._id)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary/60", isActive && "bg-primary/10 text-primary font-medium")}>
                    <Avatar name={g.name} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-xs font-medium", isActive && "text-primary")}>{g.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{g.lastMessage?.content || `${g.memberCount ?? g.members.length} members`}</p>
                    </div>
                    {unread > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{unread}</span>}
                  </button>
                );
              })}
            </>
          )}
          {!liveGroups.length && <p className="p-4 text-center text-xs text-muted-foreground">No chats yet — start a private chat or ask an admin to create a group</p>}
        </div>
      </Card>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Create Group Form */}
        {showCreateForm && isAdmin && (
          <Card className="mx-auto w-full max-w-lg p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Create Group</h3>
              <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setShowCreateForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div><Label htmlFor="gname">Name</Label><Input id="gname" name="name" required /></div>
              <div><Label htmlFor="gdesc">Description</Label><Input id="gdesc" name="description" /></div>
              <div><Label>Members</Label>
                <div className="mt-1 grid max-h-40 gap-1 overflow-y-auto rounded-lg border p-2">
                  {staff.filter((u: any) => u._id !== currentUser?.userId).map((u: any) => (
                    <label key={u._id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-secondary/40">
                      <input type="checkbox" name="members" value={u._id} className="h-3.5 w-3.5" />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" size="sm" className="w-full">Create Group</Button>
            </form>
          </Card>
        )}

        {/* Active Group Chat */}
        {activeGroup && activeGroupData ? (
          <>
            {/* Chat Header */}
            <div className="flex shrink-0 items-center gap-3 border-b p-3">
              {!showSidebar && <Button variant="ghost" size="sm" className="h-7 px-1 md:hidden" onClick={() => setShowSidebar(true)}><ChevronLeft className="h-4 w-4" /></Button>}
              <Avatar name={activeGroupData.name} />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{activeGroupData.name}</h3>
                <p className="text-[10px] text-muted-foreground">{activeGroupData.isDM ? "Private chat" : `${activeGroupData.members.length} members${activeGroupData.description ? ` · ${activeGroupData.description}` : ""}`}</p>
              </div>
              <div className="flex gap-1">
                {activeGroupCall && (
                  <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-primary" title="Join the active call in this group" onClick={() => joinCall(activeGroupCall.callId)}>
                    <Phone className="h-3.5 w-3.5 animate-pulse" /> Join
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Audio call" onClick={() => setCallPicker("audio")}><Phone className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Video call" onClick={() => setCallPicker("video")}><Video className="h-3.5 w-3.5" /></Button>
                {isAdmin && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Add members" onClick={() => setShowAddMembers(!showAddMembers)}><UserPlus className="h-3.5 w-3.5" /></Button>}
                <form onSubmit={async (e) => { e.preventDefault(); await leaveGroup(activeGroup); router.refresh(); }}><Button type="submit" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="Leave group"><LogOut className="h-3.5 w-3.5" /></Button></form>
              </div>
            </div>

            {/* Add Members */}
            {showAddMembers && isAdmin && (
              <div className="border-b p-3">
                <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.target as HTMLFormElement); const res = await addMembers(activeGroup, fd); if (!res.ok) toast.error(res.message); else { toast.success(res.message); router.refresh(); } }} className="flex flex-wrap items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-[10px]">Add Members</Label>
                    <div className="mt-1 grid max-h-32 gap-1 overflow-y-auto rounded-lg border p-2">
                      {filteredStaff.map((u: any) => (
                        <label key={u._id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-secondary/40">
                          <input type="checkbox" name="members" value={u._id} className="h-3.5 w-3.5" />
                          {u.name}
                        </label>
                      ))}
                      {!filteredStaff.length && <p className="text-[10px] text-muted-foreground">All staff are already members</p>}
                    </div>
                  </div>
                  <Button type="submit" size="sm" className="h-8 text-xs">Add</Button>
                </form>
              </div>
            )}

            {/* Call Member Picker */}
            {callPicker && activeGroupData && (
              <div className="border-b p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-[10px]">{callPicker === "video" ? "Start video call with" : "Start audio call with"}</Label>
                  <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setCallPicker(null)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="grid max-h-32 gap-1 overflow-y-auto rounded-lg border p-2">
                  {activeGroupData.members.length > 1 && !activeGroupData.isDM && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => { setCallPicker(null); startCall(activeGroup, "all", "Everyone", callPicker); }}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-secondary/40 disabled:opacity-50"
                    >
                      <Avatar name="Everyone" className="h-6 w-6 text-[10px]" />
                      <span className="min-w-0 flex-1 truncate font-medium">Everyone in group</span>
                      {callPicker === "video" ? <Video className="h-3.5 w-3.5 text-primary" /> : <Phone className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  )}
                  {activeGroupData.members.map((m: any) => {
                    const memberId = m.userId?._id?.toString() || m.userId?.toString();
                    const memberName = m.userId?.name || m.name || "Member";
                    if (memberId === currentUser?.userId) return null;
                    return (
                      <button
                        key={memberId}
                        type="button"
                        disabled={busy}
                        onClick={() => { setCallPicker(null); startCall(activeGroup, memberId, memberName, callPicker); }}
                        className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-secondary/40 disabled:opacity-50"
                      >
                        <Avatar name={memberName} className="h-6 w-6 text-[10px]" />
                        <span className="min-w-0 flex-1 truncate font-medium">{memberName}</span>
                        {callPicker === "video" ? <Video className="h-3.5 w-3.5 text-primary" /> : <Phone className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    );
                  })}
                  {activeGroupData.members.length <= 1 && <p className="text-[10px] text-muted-foreground">No other members to call</p>}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {messages.map((msg: any) => {
                if (msg.type === "call") {
                  return (
                    <div key={msg._id} className="flex justify-center py-0.5">
                      <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-muted-foreground">
                        <Phone className="h-3 w-3 text-primary" />
                        <span className="font-medium text-foreground">{msg.content || "Call"}</span>
                        <span>{timeAgo(msg.createdAt)}</span>
                      </div>
                    </div>
                  );
                }
                return (
                <div key={msg._id} id={`msg-${msg._id}`} className="group flex gap-2.5">
                  <Avatar name={msg.senderId?.name || "U"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{msg.senderId?.name || "Unknown"}</span>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(msg.createdAt)}</span>
                      {currentUser?.userId === msg.senderId?._id && (
                        <button onClick={() => { if (confirm("Delete?")) deleteMessage(msg._id).then(() => pollMessages()); }} className="hidden group-hover:block"><Trash2 className="h-3 w-3 text-destructive" /></button>
                      )}
                    </div>

                    {/* Reply quote */}
                    {msg.replyTo && (
                      <div className="mb-1 rounded border-l-2 border-primary bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Replying</span>
                        <p className="truncate">{(msg as any).replyTo?.content || ""}</p>
                      </div>
                    )}

                    {/* Message content with mentions */}
                    {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}

                    {/* Attachments */}
                    {(msg.attachments || []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(msg.attachments || []).map((att: any, i: number) => (
                          isImage(att.mimeType) ? (
                            <a key={i} href={`/api/chat/files/${att.fileId}`} target="_blank" rel="noopener" className="group/att relative overflow-hidden rounded-lg border">
                              <img src={`/api/chat/files/${att.fileId}`} alt={att.name} className="h-24 w-24 object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/att:opacity-100"><Download className="h-5 w-5 text-white" /></div>
                            </a>
                          ) : (
                            <a key={i} href={`/api/chat/files/${att.fileId}`} download={att.name} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs hover:bg-secondary/40">
                              <FileText className="h-4 w-4 shrink-0 text-primary" />
                              <span className="truncate max-w-[120px]">{att.name}</span>
                              <Download className="h-3 w-3 shrink-0" />
                            </a>
                          )
                        ))}
                      </div>
                    )}

                    {/* Reactions */}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(msg.reactions || []).reduce((acc: any[], r: any) => {
                        const existing = acc.find((a) => a.emoji === r.emoji);
                        if (existing) existing.users.push(r.userId);
                        else acc.push({ emoji: r.emoji, users: [r.userId] });
                        return acc;
                      }, [] as { emoji: string; users: string[] }[]).map((r: any) => {
                        const reacted = r.users.includes(currentUser?.userId);
                        return (
                          <button key={r.emoji} onClick={async () => { await toggleReaction(msg._id, r.emoji); pollMessages(); }} className={cn("flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors", reacted ? "bg-primary/15 border-primary/30" : "hover:bg-secondary/40")}>
                            {r.emoji} <span className="text-[10px]">{r.users.length}</span>
                          </button>
                        );
                      })}
                      <button onClick={() => setReplyTo(msg)} className="hidden rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary/40 group-hover:inline-flex"><Reply className="h-3 w-3" /></button>
                      <div className="relative">
                        <button onClick={() => setReactingToMsg(reactingToMsg === msg._id ? null : msg._id)} className="rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary/40"><Smile className="h-3 w-3" /></button>
                        {reactingToMsg === msg._id && (
                          <div className="absolute bottom-full left-0 z-20 mb-1 grid w-56 grid-cols-5 gap-0.5 rounded-lg border bg-card p-1.5 shadow-lg">
                            {EMOJIS.map((e) => (
                              <button key={e} type="button" onMouseDown={async () => { await toggleReaction(msg._id, e); setReactingToMsg(null); pollMessages(); }} className="rounded p-1 text-base hover:bg-secondary/60">{e}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
              <div ref={messagesEnd} />
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t bg-card p-3">
              {/* Reply indicator */}
              {replyTo && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-muted/30 px-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-primary">Replying to {replyTo.senderId?.name || "Unknown"}</p>
                    <p className="truncate text-xs text-muted-foreground">{replyTo.content || "Attachment"}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></Button>
                </div>
              )}

              {/* File previews */}
              {selectedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {selectedFiles.map((f, i) => (
                    <div key={i} className="relative rounded-lg border p-1.5">
                      {isImage(f.type) ? <img src={URL.createObjectURL(f)} className="h-12 w-12 rounded object-cover" /> : <FileText className="h-12 w-12 p-2 text-muted-foreground" />}
                      <button onClick={() => removeFile(i)} className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-white"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative flex items-end gap-2">
                {/* Emoji picker */}
                {showEmoji && (
                  <div className="absolute bottom-full left-0 z-10 mb-2 grid w-64 grid-cols-5 gap-1 rounded-lg border bg-card p-2 shadow-lg">
                    {EMOJIS.map((e) => (
                      <button key={e} type="button" onClick={() => addEmoji(e)} className="rounded p-1 text-lg hover:bg-secondary/60">{e}</button>
                    ))}
                  </div>
                )}

                <input ref={fileInput} type="file" multiple className="hidden" onChange={handleFileSelect} />
                <Button variant="ghost" size="sm" className="h-9 w-9 shrink-0 p-0" onClick={() => fileInput.current?.click()}><Paperclip className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className={cn("h-9 w-9 shrink-0 p-0", showEmoji && "bg-secondary")} onClick={() => setShowEmoji(!showEmoji)}><Smile className="h-4 w-4" /></Button>

                <div className="relative flex-1">
                  <textarea
                    ref={textRef}
                    value={composerText}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... @ to mention"
                    rows={1}
                    className="min-h-[36px] w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary"
                  />
                  {mentionOpen && mentionMatches.length > 0 && (
                    <div className="absolute bottom-full left-0 z-10 mb-1 w-56 rounded-lg border bg-card p-1 shadow-lg">
                      {mentionMatches.slice(0, 6).map((u: any, i: number) => (
                        <button key={u._id} type="button" onMouseDown={() => insertMention(u)} className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs", i === mentionIndex && "bg-secondary/60")}>
                          <AtSign className="h-3 w-3" /> {u.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={handleSend} disabled={sending || (!composerText.trim() && !selectedFiles.length)} size="sm" className="h-9 w-9 shrink-0 p-0">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">Select a group to start chatting</p>
              {isAdmin && <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreateForm(true)}><Plus className="h-4 w-4" /> Create Group</Button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
