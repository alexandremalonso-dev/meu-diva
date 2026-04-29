"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, MessageCircle, User, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getFotoSrc } from "@/lib/utils";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import MobileNotificationsDrawer from "./MobileNotificationsDrawer";
import MobileChatDrawer from "./MobileChatDrawer";

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  backTo?: string;
}

const COLORS = { primary: "#E03673" };

export default function MobileHeader({ title, showBack = false, backTo }: MobileHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!user) return;
    const endpoint = user.role === "therapist" ? "/api/therapists/me/profile" : "/api/patient/profile";
    api(endpoint).then(setUserData).catch(() => null);
    loadUnreadCounts();
    const interval = setInterval(loadUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const loadUnreadCounts = async () => {
    try {
      const [notifData, chatData] = await Promise.all([
        api("/api/notifications/unread/count").catch(() => null),
        api("/api/chat/conversations").catch(() => null),
      ]);
      setUnreadNotifications(notifData?.unread_count ?? 0);
      const totalUnread = (chatData || []).reduce((acc: number, c: any) => acc + (c.unread_count || 0), 0);
      setUnreadMessages(totalUnread);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBack = () => {
    if (backTo) router.push(backTo);
    else router.back();
  };

  const handleHome = () => router.push("/mobile/dashboard");

  const handleLogout = async () => {
    setShowMenu(false);
    await logout();
    router.push("/mobile/login");
  };

  const profileLink = user?.role === "therapist" ? "/therapist/profile" : "/patient/profile";

  const fotoSrc = getFotoSrc(userData?.foto_url);
  const initials = user?.full_name
    ? user.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <>
      <div style={{
        backgroundColor: COLORS.primary,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>

        {/* ESQUERDA */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showBack && (
            <button
              onClick={handleBack}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
            >
              <ArrowLeft size={22} color="white" />
            </button>
          )}
          <button
            onClick={handleHome}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8 }}
          >
            <Image
              src="/logo-mobile.png"
              alt="Meu Divã"
              width={52}
              height={52}
              style={{ objectFit: "contain", filter: "drop-shadow(0px 1px 3px rgba(0,0,0,0.25))" }}
            />
            {!showBack && (
              <span style={{ color: "white", fontSize: 16, fontWeight: 600, letterSpacing: 0.3 }}>
                Meu Divã
              </span>
            )}
            {showBack && title && (
              <span style={{ color: "white", fontSize: 16, fontWeight: 600 }}>
                {title}
              </span>
            )}
          </button>
        </div>

        {/* DIREITA */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>

          {/* CHAT */}
          <button
            onClick={() => setShowChat(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", position: "relative" }}
          >
            <MessageCircle size={22} color="rgba(255,255,255,0.9)" />
            {unreadMessages > 0 && (
              <div style={{
                position: "absolute", top: 2, right: 2,
                width: 16, height: 16, borderRadius: "50%",
                background: "#FB8811", border: "1.5px solid white",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 9, color: "white", fontWeight: 700 }}>
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              </div>
            )}
          </button>

          {/* NOTIFICAÇÕES */}
          <button
            onClick={() => setShowNotifications(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", position: "relative" }}
          >
            <Bell size={22} color="rgba(255,255,255,0.9)" />
            {unreadNotifications > 0 && (
              <div style={{
                position: "absolute", top: 2, right: 2,
                width: 16, height: 16, borderRadius: "50%",
                background: "#FB8811", border: "1.5px solid white",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 9, color: "white", fontWeight: 700 }}>
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              </div>
            )}
          </button>

          {/* AVATAR + DROPDOWN */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                overflow: "hidden", border: "2px solid rgba(255,255,255,0.5)",
                cursor: "pointer", background: "rgba(255,255,255,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
              }}
            >
              {fotoSrc ? (
                <img
                  src={fotoSrc}
                  alt={user?.full_name || ""}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ color: "white", fontSize: 13, fontWeight: 500 }}>{initials}</span>
              )}
            </button>

            {/* DROPDOWN MENU */}
            {showMenu && (
              <>
                {/* Overlay para fechar */}
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 10 }}
                  onClick={() => setShowMenu(false)}
                />
                <div style={{
                  position: "absolute", right: 0, top: 44,
                  backgroundColor: "white", borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                  overflow: "hidden", minWidth: 180, zIndex: 20,
                  border: "1px solid #F3F4F6",
                }}>
                  {/* Info do usuário */}
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", backgroundColor: "#F9F5FF" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#3A3B21", margin: 0 }}>
                      {user?.full_name || "Usuário"}
                    </p>
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0" }}>
                      {user?.role === "therapist" ? "Terapeuta" : "Paciente"}
                    </p>
                  </div>

                  {/* Meu Perfil */}
                  <button
                    onClick={() => { setShowMenu(false); router.push(profileLink); }}
                    style={{
                      width: "100%", padding: "12px 16px",
                      display: "flex", alignItems: "center", gap: 10,
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 14, color: "#374151", textAlign: "left",
                    }}
                  >
                    <User size={16} color="#E03673" />
                    Meu Perfil
                  </button>

                  {/* Sair */}
                  <button
                    onClick={handleLogout}
                    style={{
                      width: "100%", padding: "12px 16px",
                      display: "flex", alignItems: "center", gap: 10,
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 14, color: "#EF4444", textAlign: "left",
                      borderTop: "1px solid #F3F4F6",
                    }}
                  >
                    <LogOut size={16} color="#EF4444" />
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* DRAWERS */}
      <MobileNotificationsDrawer
        isOpen={showNotifications}
        onClose={() => { setShowNotifications(false); loadUnreadCounts(); }}
      />
      <MobileChatDrawer
        isOpen={showChat}
        onClose={() => { setShowChat(false); loadUnreadCounts(); }}
      />
    </>
  );
}