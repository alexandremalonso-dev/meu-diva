"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, Calendar, Video, Mail, Star, AlertCircle } from "lucide-react";
import MobileDrawer from "./MobileDrawer";
import { api } from "@/lib/api";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  action_link?: string;
  created_at: string;
}

interface MobileNotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = {
  primary: "#E03673",
  secondary: "#2F80D3",
};

function getIcon(type: string) {
  if (type.includes("appointment") || type.includes("session")) return <Calendar size={18} color={COLORS.secondary} />;
  if (type.includes("video") || type.includes("meet")) return <Video size={18} color={COLORS.primary} />;
  if (type.includes("invite")) return <Mail size={18} color={COLORS.secondary} />;
  if (type.includes("review") || type.includes("rating")) return <Star size={18} color="#FB8811" />;
  return <AlertCircle size={18} color={COLORS.primary} />;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

export default function MobileNotificationsDrawer({ isOpen, onClose }: MobileNotificationsDrawerProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) loadNotifications();
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await api("/api/notifications?limit=30");
      setNotifications(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api("/api/notifications/mark-all-read", { method: "POST" });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const markRead = async (id: number) => {
    try {
      await api("/api/notifications/mark-read", {
        method: "POST",
        body: JSON.stringify({ notification_ids: [id] }),
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <MobileDrawer isOpen={isOpen} onClose={onClose} title={`Notificações${unreadCount > 0 ? ` (${unreadCount})` : ""}`}>
      <div style={{ padding: "8px 0" }}>

        {/* MARCAR TODAS COMO LIDAS */}
        {unreadCount > 0 && (
          <div style={{ padding: "8px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <button
              onClick={markAllRead}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                color: COLORS.secondary,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                padding: 0,
              }}
            >
              <CheckCheck size={16} />
              Marcar todas como lidas
            </button>
          </div>
        )}

        {/* LISTA */}
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
            Carregando...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Bell size={40} color="#E5E7EB" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Nenhuma notificação</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 16px",
                borderBottom: "1px solid #F9FAFB",
                background: n.is_read ? "white" : "#FFF5F8",
                cursor: n.is_read ? "default" : "pointer",
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: n.is_read ? "#F3F4F6" : "#FDE8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                {getIcon(n.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: "#111827", margin: 0 }}>
                    {n.title}
                  </p>
                  <span style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0 }}>
                    {formatTime(n.created_at)}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0", lineHeight: 1.4 }}>
                  {n.message}
                </p>
              </div>
              {!n.is_read && (
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.primary, flexShrink: 0, marginTop: 4 }} />
              )}
            </div>
          ))
        )}
      </div>
    </MobileDrawer>
  );
}