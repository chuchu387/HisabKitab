"use client";

import { useEffect, useRef, useState } from "react";

export type RealtimeChatGroup = {
  _id: string;
  name: string;
  description: string;
  updatedAt?: string;
  memberCount: number;
  lastMessage: { content: string; senderId?: any; createdAt?: string } | null;
};

export type RealtimeNotification = {
  _id: string;
  title: string;
  message: string;
  href?: string;
  readAt?: string | null;
  createdAt?: string;
};

export type RealtimeCall = {
  callId: string;
  groupId?: string;
  initiatorId: string;
  initiatorName: string;
  mode: "audio" | "video";
  status: string;
  myStatus: string;
  createdAt?: string;
};

export function useRealtime(initial: { unreadCount: number; notifications: any[]; chatGroups: any[] }) {
  const [unreadCount, setUnreadCount] = useState(initial.unreadCount);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>(initial.notifications);
  const [chatGroups, setChatGroups] = useState<RealtimeChatGroup[]>(initial.chatGroups);
  const [calls, setCalls] = useState<RealtimeCall[]>([]);
  const initialRef = useRef(initial);

  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);

  useEffect(() => {
    let source: EventSource | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      source = new EventSource("/api/realtime");
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== "tick") return;
          if (data.unreadCount !== undefined) setUnreadCount(data.unreadCount);
          if (Array.isArray(data.notifications)) setNotifications(data.notifications);
          if (Array.isArray(data.chatGroups)) setChatGroups(data.chatGroups);
          if (Array.isArray(data.calls)) setCalls(data.calls);
        } catch {}
      };
      source.onerror = () => {
        source?.close();
        if (!closed) setTimeout(connect, 4000);
      };
    };

    connect();
    return () => {
      closed = true;
      source?.close();
    };
  }, []);

  return { unreadCount, notifications, chatGroups, calls };
}
